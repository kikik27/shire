import type { Express, Request, Response, NextFunction } from "express";

import { env } from "../env";
import { logger } from "../runtime/logger";
import { summarizeChatRequestBody } from "../runtime/chat-request-logging";
import {
  classifyChatRequest,
  createChatFallbackStream,
} from "../runtime/chat-guard";
import { classifySecurityIndicator } from "../runtime/security-indicators";
import { enforceChatRateLimit } from "../runtime/chat-caller";
import { searchProductKnowledge } from "../runtime/knowledge";
import { enrichChatRequestWithProductKnowledge } from "../runtime/product-knowledge";
import { validateChatRequest } from "../runtime/chat-validation";
import type { RateLimiter } from "../runtime/rate-limit";
import { guardSecurityPrompt } from "../runtime/security-guard";
import { evaluateSecurityPolicy } from "../runtime/security-policy";
import { hasValidServiceToken } from "../runtime/internal-auth";

const chatLogger = logger.child({ component: "chat-middleware" });

export interface ChatMiddlewareDependencies {
  serviceToken?: string;
  rateLimiter: RateLimiter;
  now?: () => number;
  securityIndicatorClassifier?: typeof classifySecurityIndicator;
  securityGuard?: typeof guardSecurityPrompt;
  searchProductKnowledge?: typeof searchProductKnowledge;
}

/**
 * Auth gate for the chat route. Rejects requests without a valid service token
 * before any other processing happens.
 */
export function mountChatAuth(app: Express, serviceToken: string | undefined) {
  app.use("/chat/:agentId", (request, response, next) => {
    if (!hasValidServiceToken(request.header("authorization"), serviceToken)) {
      response.status(401).json({ status: "unauthorized" });
      return;
    }
    next();
  });
}

/**
 * Structured request logging for the chat route: logs the inbound request and,
 * on response finish, its status code and duration. Failed responses (>=400)
 * are logged at error level for visibility.
 */
export function mountChatLogging(app: Express) {
  app.use("/chat/:agentId", (request, response, next) => {
    const startedAt = Date.now();
    const agentId = request.params.agentId;

    chatLogger.info(
      {
        agentId,
        method: request.method,
        path: request.originalUrl,
        body: summarizeChatRequestBody(request.body),
      },
      "chat request received",
    );

    response.on("finish", () => {
      chatLogger.info(
        {
          agentId,
          method: request.method,
          path: request.originalUrl,
          statusCode: response.statusCode,
          durationMs: Date.now() - startedAt,
        },
        "chat request completed",
      );

      if (response.statusCode >= 400) {
        chatLogger.error(
          {
            agentId,
            method: request.method,
            path: request.originalUrl,
            statusCode: response.statusCode,
            durationMs: Date.now() - startedAt,
          },
          "chat request failed",
        );
      }
    });

    next();
  });
}

/**
 * The role-aware-chat guard chain. Runs only for POST requests targeting
 * role-aware-chat-agent, in order: validation → rate-limit → security guard →
 * RAG enrichment. Blocked requests short-circuit with a deterministic SSE
 * fallback stream; allowed requests mutate request.body with retrieved product
 * knowledge and hand off to Mastra.
 */
export function mountChatGuard(
  app: Express,
  dependencies: ChatMiddlewareDependencies,
) {
  app.use("/chat/:agentId", async (request, response, next) => {
    if (
      request.method !== "POST" ||
      request.params.agentId !== "role-aware-chat-agent"
    ) {
      next();
      return;
    }

    await runChatGuard(request, response, next, dependencies);
  });
}

async function runChatGuard(
  request: Request,
  response: Response,
  next: NextFunction,
  dependencies: ChatMiddlewareDependencies,
) {
  // 1. Validate request shape and limits.
  const validation = validateChatRequest(request.body, {
    maxBodyBytes: env.chatMaxBodyBytes,
    maxMessages: env.chatMaxMessages,
    maxMessageCharacters: env.chatMaxMessageCharacters,
  });

  if (validation.valid === false) {
    chatLogger.warn(
      {
        agentId: request.params.agentId,
        reasonCode: validation.reasonCode,
      },
      "chat request blocked by validation",
    );

    response
      .status(200)
      .set({
        "cache-control": "no-cache",
        connection: "keep-alive",
        "content-type": "text/event-stream; charset=utf-8",
        "x-vercel-ai-ui-message-stream": "v1",
      })
      .send(
        createChatFallbackStream({
          decision: "out-of-scope",
          messageLength: 0,
        }),
      );
    return;
  }

  // 2. Rate limit per caller (viewerId or IP).
  const rateResult = await enforceChatRateLimit(
    request.body,
    {
      rateLimiter: dependencies.rateLimiter,
      now: dependencies.now,
      ip: request.ip,
    },
    env.chatRateLimitRequests,
    env.chatRateLimitWindowSeconds * 1000,
  );

  if (rateResult.allowed === false) {
    chatLogger.warn(
      {
        agentId: request.params.agentId,
        callerKey: rateResult.callerKey,
        retryAfterSeconds: rateResult.retryAfterSeconds,
      },
      "chat request rate limited",
    );

    response
      .status(429)
      .set({
        "cache-control": "no-cache",
        connection: "keep-alive",
        "content-type": "text/event-stream; charset=utf-8",
        "x-vercel-ai-ui-message-stream": "v1",
        "retry-after": rateResult.retryAfterSeconds.toString(),
      })
      .send(
        createChatFallbackStream({
          decision: "out-of-scope",
          messageLength: 0,
        }),
      );
    return;
  }

  // 3. Security guard (regex indicator -> LLM/regex confirmation -> policy).
  await applySecurityGuard(request, response, dependencies);
  if (response.headersSent) {
    return;
  }

  // 4. Pre-model guard (deterministic out-of-scope / injection classification).
  const decision = classifyChatRequest(request.body);
  if (decision.decision !== "allow") {
    chatLogger.warn(
      {
        agentId: request.params.agentId,
        classification: decision.decision,
        messageLength: decision.messageLength,
      },
      "chat request blocked by pre-model guard",
    );

    response
      .status(200)
      .set({
        "cache-control": "no-cache",
        connection: "keep-alive",
        "content-type": "text/event-stream; charset=utf-8",
        "x-vercel-ai-ui-message-stream": "v1",
      })
      .send(createChatFallbackStream(decision));
    return;
  }

  // 5. RAG enrichment — mutate request.body with retrieved product knowledge.
  await enrichWithProductKnowledge(request, dependencies);

  next();
}

async function applySecurityGuard(
  request: Request,
  response: Response,
  dependencies: ChatMiddlewareDependencies,
) {
  const securityIndicatorClassifier =
    dependencies.securityIndicatorClassifier ?? classifySecurityIndicator;
  const securityGuard = dependencies.securityGuard ?? guardSecurityPrompt;
  const existingSecurityIndicator = securityIndicatorClassifier(request.body);
  if (existingSecurityIndicator.level !== "suspicious") {
    return;
  }

  try {
    const securityGuardDecision = await securityGuard(request.body);
    const securityPolicyDecision = evaluateSecurityPolicy(
      securityGuardDecision,
    );

    if (securityPolicyDecision.decision === "block") {
      chatLogger.warn(
        {
          agentId: request.params.agentId,
          risk: securityGuardDecision.risk,
          category: securityGuardDecision.category,
          reasonCode: securityGuardDecision.reasonCode,
          detectedLanguage: securityGuardDecision.detectedLanguage,
        },
        "chat request blocked by security guard",
      );

      response
        .status(200)
        .set({
          "cache-control": "no-cache",
          connection: "keep-alive",
          "content-type": "text/event-stream; charset=utf-8",
          "x-vercel-ai-ui-message-stream": "v1",
        })
        .send(
          createChatFallbackStream({
            decision: "prompt-injection",
            messageLength: securityGuardDecision.text.length,
          }),
        );
    }
  } catch (error) {
    chatLogger.warn(
      {
        agentId: request.params.agentId,
        err: error,
      },
      "security guard unavailable, continuing with fallback policy",
    );
  }
}

async function enrichWithProductKnowledge(
  request: Request,
  dependencies: ChatMiddlewareDependencies,
) {
  const startedAt = Date.now();
  const enrichment = await enrichChatRequestWithProductKnowledge(
    request.body,
    dependencies.searchProductKnowledge ?? searchProductKnowledge,
  );
  request.body = enrichment.body;

  const logContext = {
    agentId: request.params.agentId,
    role: enrichment.role,
    resultCount: enrichment.resultCount,
    durationMs: Date.now() - startedAt,
  };

  if (enrichment.retrievalFailed) {
    chatLogger.warn(logContext, "product knowledge retrieval failed");
  } else {
    chatLogger.info(logContext, "product knowledge retrieval completed");
  }
}
