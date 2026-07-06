import type { Express, Request, Response, NextFunction } from "express";

import { env } from "../env";
import {
  AI_SDK_STREAM_HEADERS,
  CHAT_ROUTE_PATTERN,
  ROLE_AWARE_CHAT_AGENT_ID,
} from "../constants/agent";
import { logger } from "../runtime/logger";
import { observeChatStream } from "./chat-stream-observer";
import { summarizeChatRequestBody } from "../runtime/chat/request-logging";
import { persistChatTurn } from "../runtime/chat/persist-messages";
import {
  classifyChatRequest,
  createChatFallbackStream,
} from "../runtime/chat/guard";
import { classifySecurityIndicator } from "../runtime/security/indicators";
import { enforceChatRateLimit } from "../runtime/chat/caller";
import { searchProductKnowledge } from "../runtime/knowledge";
import { enrichChatRequestWithProductKnowledge } from "../runtime/knowledge/product-context";
import { validateChatRequest } from "../runtime/chat/validation";
import type { RateLimiter } from "../runtime/auth/rate-limit";
import { guardSecurityPrompt } from "../runtime/security/guard";
import { confirmSecurityRiskWithLlm } from "../runtime/security/guard-llm";
import { evaluateSecurityPolicy } from "../runtime/security/policy";
import { hasValidServiceToken } from "../runtime/auth/internal";
import { selectChatSecurityInput } from "../runtime/chat/security-input";

const chatLogger = logger.child({ component: "chat-middleware" });

/**
 * Persist the completed chat turn to the memory substore. Guards against
 * missing memory/messages and lazy-imports the shared memory singleton so the
 * libSQL client is only touched when there is actually something to persist.
 * Never throws — see persistChatTurn.
 */
function persistCompletedTurn(body: unknown, assistantText: string): void {
  if (!body || typeof body !== "object") return;
  const record = body as Record<string, unknown>;
  const memory = record.memory;
  const messages = record.messages;
  if (!memory || typeof memory !== "object") return;
  if (!Array.isArray(messages)) return;

  const thread = (memory as Record<string, unknown>).thread;
  const resource = (memory as Record<string, unknown>).resource;
  if (typeof thread !== "string" || typeof resource !== "string") return;
  if (!thread || !resource) return;

  void (async () => {
    try {
      const { agentMemory } = await import("../runtime/memory");
      const memoryStore = await (
        agentMemory as unknown as {
          getMemoryStore: () => Promise<{
            saveThread: (args: unknown) => Promise<unknown>;
            saveMessages: (args: { messages: unknown[] }) => Promise<unknown>;
          }>;
        }
      ).getMemoryStore();
      await persistChatTurn({
        memoryStore,
        thread,
        resource,
        userMessages: messages,
        assistantText,
      });
    } catch (error) {
      chatLogger.warn(
        { threadId: thread, err: String(error) },
        "chat memory persistence skipped",
      );
    }
  })();
}

export interface ChatMiddlewareDependencies {
  serviceToken?: string;
  rateLimiter: RateLimiter;
  now?: () => number;
  securityIndicatorClassifier?: typeof classifySecurityIndicator;
  securityGuard?: typeof guardSecurityPrompt;
  /**
   * LLM confirmation for inputs the regex layer flags as suspicious-but-ambiguous.
   * Production path; tests can stub it to avoid real model calls.
   */
  confirmSecurityRisk?: typeof confirmSecurityRiskWithLlm;
  searchProductKnowledge?: typeof searchProductKnowledge;
}

/**
 * Auth gate for the chat route. Rejects requests without a valid service token
 * before any other processing happens.
 */
export function mountChatAuth(app: Express, serviceToken: string | undefined) {
  app.use(CHAT_ROUTE_PATTERN, (request, response, next) => {
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
  app.use(CHAT_ROUTE_PATTERN, (request, response, next) => {
    const startedAt = Date.now();
    const agentId = request.params.agentId;
    const streamObserver = observeChatStream(request, response, startedAt);

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
      streamObserver.finish("finish");
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
        return;
      }

      // Workaround for @mastra/core 1.49.x not persisting messages on
      // agent.stream(): save the completed turn (user + assistant) directly
      // to the memory substore after a successful stream. Fire-and-forget —
      // errors are caught inside persistChatTurn and never break the response.
      persistCompletedTurn(request.body, streamObserver.getAssistantText());
    });
    response.on("close", () => {
      streamObserver.finish("close");
    });
    response.on("error", (error) => {
      streamObserver.finish("error", error);
    });

    next();
  });
}

/**
 * The role-aware-chat guard chain. Runs only for POST requests targeting
 * role-aware-chat-agent, in order: validation -> rate-limit -> security guard ->
 * RAG enrichment. Blocked requests short-circuit with a deterministic SSE
 * fallback stream; allowed requests mutate request.body with retrieved product
 * knowledge and hand off to Mastra.
 */
export function mountChatGuard(
  app: Express,
  dependencies: ChatMiddlewareDependencies,
) {
  app.use(CHAT_ROUTE_PATTERN, async (request, response, next) => {
    if (
      request.method !== "POST" ||
      request.params.agentId !== ROLE_AWARE_CHAT_AGENT_ID
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
  const guardStartedAt = Date.now();
  const logStep = (
    step: string,
    startedAt: number,
    extra: Record<string, unknown> = {},
  ) => {
    chatLogger.info(
      {
        agentId: request.params.agentId,
        step,
        durationMs: Date.now() - startedAt,
        totalDurationMs: Date.now() - guardStartedAt,
        ...extra,
      },
      "chat guard step completed",
    );
  };

  // 1. Validate request shape and limits.
  let stepStartedAt = Date.now();
  const validation = validateChatRequest(request.body, {
    maxBodyBytes: env.chatMaxBodyBytes,
    maxMessages: env.chatMaxMessages,
    maxMessageCharacters: env.chatMaxMessageCharacters,
  });
  logStep("validation", stepStartedAt, { valid: validation.valid });

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
      .set(AI_SDK_STREAM_HEADERS)
      .send(
        createChatFallbackStream({
          decision: "out-of-scope",
          messageLength: 0,
        }),
      );
    return;
  }

  // 2. Rate limit per caller (viewerId or IP).
  stepStartedAt = Date.now();
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
  logStep("rate-limit", stepStartedAt, {
    allowed: rateResult.allowed,
    callerKey: rateResult.callerKey,
  });

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
        ...AI_SDK_STREAM_HEADERS,
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
  stepStartedAt = Date.now();
  await applySecurityGuard(request, response, dependencies);
  logStep("security-guard", stepStartedAt, {
    headersSent: response.headersSent,
  });
  if (response.headersSent) {
    return;
  }

  // 4. Pre-model guard (deterministic out-of-scope / injection classification).
  stepStartedAt = Date.now();
  const decision = classifyChatRequest(request.body);
  logStep("pre-model-guard", stepStartedAt, {
    decision: decision.decision,
    messageLength: decision.messageLength,
  });
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
      .set(AI_SDK_STREAM_HEADERS)
      .send(createChatFallbackStream(decision));
    return;
  }

  // 5. RAG enrichment: mutate request.body with retrieved product knowledge.
  stepStartedAt = Date.now();
  await enrichWithProductKnowledge(request, dependencies);
  logStep("product-knowledge", stepStartedAt);

  chatLogger.info(
    {
      agentId: request.params.agentId,
      totalDurationMs: Date.now() - guardStartedAt,
    },
    "chat guard completed, handing off to Mastra",
  );
  next();
}

async function applySecurityGuard(
  request: Request,
  response: Response,
  dependencies: ChatMiddlewareDependencies,
) {
  const securityIndicatorClassifier =
    dependencies.securityIndicatorClassifier ?? classifySecurityIndicator;
  const securityInput = selectChatSecurityInput(request.body);
  const existingSecurityIndicator = securityIndicatorClassifier(securityInput);
  if (existingSecurityIndicator.level !== "suspicious") {
    return;
  }

  try {
    const securityGuardDecision = await resolveSecurityGuardDecision(
      securityInput,
      existingSecurityIndicator.text,
      dependencies,
    );
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
        .set(AI_SDK_STREAM_HEADERS)
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

/**
 * Resolve the final security decision for a suspicious input.
 *
 * - When a `securityGuard` override is supplied (tests / explicit wiring), use
 *   it directly so existing synchronous behavior and tests are preserved.
 * - Otherwise run the deterministic regex layer first. If the regex is already
 *   confident (high risk, clear category), block without spending an LLM call.
 *   If the regex is ambiguous (medium risk), ask the security-guard capability
 *   model to confirm; on any LLM failure fall back to the regex decision.
 */
async function resolveSecurityGuardDecision(
  body: unknown,
  suspiciousText: string,
  dependencies: ChatMiddlewareDependencies,
) {
  if (dependencies.securityGuard) {
    return dependencies.securityGuard(body);
  }

  const regexDecision = guardSecurityPrompt(body);

  // Clear high-risk regex hit: block immediately, no LLM call needed.
  if (
    regexDecision.risk === "high" &&
    regexDecision.category !== "none" &&
    regexDecision.category !== "other"
  ) {
    return regexDecision;
  }

  // Ambiguous (medium/low-confidence suspicious): confirm with the LLM.
  const confirm = dependencies.confirmSecurityRisk ?? confirmSecurityRiskWithLlm;
  const llmDecision = await confirm(suspiciousText);
  return llmDecision ?? regexDecision;
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
