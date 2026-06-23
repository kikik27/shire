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
import { confirmSecurityRiskWithLlm } from "../runtime/security-guard-llm";
import { evaluateSecurityPolicy } from "../runtime/security-policy";
import { hasValidServiceToken } from "../runtime/internal-auth";

const chatLogger = logger.child({ component: "chat-middleware" });

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
      }
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

function observeChatStream(
  request: Request,
  response: Response,
  requestStartedAt: number,
) {
  const agentId = request.params.agentId;
  const originalWrite = response.write.bind(response);
  const originalEnd = response.end.bind(response);
  let eventCount = 0;
  let byteCount = 0;
  let firstChunkAt: number | undefined;
  let lastEventType: string | undefined;
  let completed = false;
  let stallTimer: NodeJS.Timeout | undefined;
  const hiddenReasoningSanitizer = createAiSdkHiddenReasoningStreamSanitizer();

  const clearStallTimer = () => {
    if (stallTimer) {
      clearTimeout(stallTimer);
      stallTimer = undefined;
    }
  };

  const armStallTimer = () => {
    clearStallTimer();
    if (completed) return;
    stallTimer = setTimeout(() => {
      chatLogger.warn(
        {
          agentId,
          eventCount,
          byteCount,
          lastEventType,
          statusCode: response.statusCode,
          durationMs: Date.now() - requestStartedAt,
        },
        "chat stream stalled waiting for next event",
      );
    }, 5000);
    stallTimer.unref?.();
  };

  const inspectChunk = (chunk: unknown) => {
    const text = normalizeChunk(chunk);
    if (!text) return;

    byteCount += Buffer.byteLength(text);
    if (firstChunkAt === undefined) {
      firstChunkAt = Date.now();
      chatLogger.info(
        {
          agentId,
          statusCode: response.statusCode,
          durationMs: firstChunkAt - requestStartedAt,
        },
        "chat stream first chunk sent",
      );
    }

    for (const eventType of parseAiSdkDataEventTypes(text)) {
      eventCount += 1;
      lastEventType = eventType;
      chatLogger.info(
        {
          agentId,
          eventType,
          eventCount,
          byteCount,
          durationMs: Date.now() - requestStartedAt,
        },
        "chat stream event sent",
      );
    }

    armStallTimer();
  };

  (response.write as unknown as (...args: unknown[]) => unknown) = (
    chunk: unknown,
    ...args: unknown[]
  ) => {
    const sanitizedChunk = hiddenReasoningSanitizer.sanitize(chunk);
    inspectChunk(sanitizedChunk);
    if (sanitizedChunk === "") {
      const callback = args.find((arg): arg is () => void => typeof arg === "function");
      callback?.();
      return true;
    }
    return originalWrite(sanitizedChunk as never, ...args as never[]);
  };

  (response.end as unknown as (...args: unknown[]) => unknown) = (
    chunk?: unknown,
    ...args: unknown[]
  ) => {
    const sanitizedChunk =
      chunk === undefined
        ? hiddenReasoningSanitizer.flush()
        : hiddenReasoningSanitizer.sanitize(chunk);
    const trailingChunk = hiddenReasoningSanitizer.flush();
    const finalChunk =
      typeof sanitizedChunk === "string" && typeof trailingChunk === "string"
        ? `${sanitizedChunk}${trailingChunk}`
        : sanitizedChunk;

    inspectChunk(finalChunk);
    if (finalChunk === "") {
      return originalEnd(undefined as never, ...args as never[]);
    }
    return originalEnd(finalChunk as never, ...args as never[]);
  };

  return {
    finish(reason: "finish" | "close" | "error", error?: Error) {
      if (completed) return;
      completed = true;
      clearStallTimer();
      chatLogger.info(
        {
          agentId,
          reason,
          err: error,
          eventCount,
          byteCount,
          firstChunkDelayMs:
            firstChunkAt === undefined ? undefined : firstChunkAt - requestStartedAt,
          durationMs: Date.now() - requestStartedAt,
          lastEventType,
          statusCode: response.statusCode,
        },
        "chat stream observation completed",
      );
    },
  };
}

function normalizeChunk(chunk: unknown) {
  if (typeof chunk === "string") return chunk;
  if (Buffer.isBuffer(chunk)) return chunk.toString("utf8");
  if (chunk instanceof Uint8Array) return Buffer.from(chunk).toString("utf8");
  return "";
}

export function createAiSdkHiddenReasoningStreamSanitizer() {
  let sseLineBuffer = "";
  let insideHiddenReasoning = false;
  let currentReasoningId: string | undefined;
  let reasoningIndex = 0;
  const emittedStatuses = new Set<string>();

  const createReasoningId = () => {
    reasoningIndex += 1;
    return `masked-thinking-${reasoningIndex}`;
  };

  const createSseLine = (event: Record<string, unknown>) =>
    `data: ${JSON.stringify(event)}`;

  const emitThinkingStatus = (rawText: string) => {
    if (!currentReasoningId) return [];

    const status = summarizeHiddenReasoning(rawText);
    if (!status || emittedStatuses.has(status)) return [];

    emittedStatuses.add(status);
    return [
      createSseLine({
        type: "reasoning-delta",
        id: currentReasoningId,
        delta: status,
      }),
    ];
  };

  const stripHiddenReasoningDelta = (delta: string) => {
    let output = "";
    let remaining = delta;
    const events: string[] = [];

    while (remaining.length > 0) {
      if (insideHiddenReasoning) {
        const closeTag = findThinkTag(remaining, "close");
        if (!closeTag) {
          events.push(...emitThinkingStatus(remaining));
          return { delta: output, events };
        }

        events.push(...emitThinkingStatus(remaining.slice(0, closeTag.index)));
        remaining = remaining.slice(closeTag.index + closeTag.length);
        insideHiddenReasoning = false;
        if (currentReasoningId) {
          events.push(
            createSseLine({ type: "reasoning-end", id: currentReasoningId }),
          );
        }
        currentReasoningId = undefined;
        continue;
      }

      const openTag = findThinkTag(remaining, "open");
      if (!openTag) {
        output += remaining;
        return { delta: output, events };
      }

      output += remaining.slice(0, openTag.index);
      remaining = remaining.slice(openTag.index + openTag.length);
      insideHiddenReasoning = true;
      currentReasoningId = createReasoningId();
      emittedStatuses.clear();
      events.push(createSseLine({ type: "reasoning-start", id: currentReasoningId }));
      events.push(...emitThinkingStatus(remaining));
    }

    return { delta: output, events };
  };

  const sanitizeSseLine = (line: string) => {
    if (!line.startsWith("data: ")) {
      return [line];
    }

    const data = line.slice("data: ".length).trim();
    if (!data || data === "[DONE]") {
      return [line];
    }

    try {
      const parsed = JSON.parse(data) as { type?: unknown; delta?: unknown };
      if (parsed.type !== "text-delta" || typeof parsed.delta !== "string") {
        return [line];
      }

      const { delta, events } = stripHiddenReasoningDelta(parsed.delta);
      if (!delta) {
        return events.length ? events : undefined;
      }

      return [...events, createSseLine({ ...parsed, delta })];
    } catch {
      return [line];
    }
  };

  return {
    sanitize(chunk: unknown) {
      const text = normalizeChunk(chunk);
      if (!text) return chunk;

      sseLineBuffer += text;
      const lines = sseLineBuffer.split(/\n/);
      sseLineBuffer = lines.pop() ?? "";

      const sanitizedLines: string[] = [];
      for (const line of lines) {
        const sanitizedLine = sanitizeSseLine(line);
        if (sanitizedLine !== undefined) {
          sanitizedLines.push(...sanitizedLine);
        }
      }

      return sanitizedLines.length ? `${sanitizedLines.join("\n")}\n` : "";
    },
    flush() {
      if (!sseLineBuffer) return "";
      const sanitizedLine = sanitizeSseLine(sseLineBuffer);
      sseLineBuffer = "";
      return sanitizedLine === undefined ? "" : sanitizedLine.join("\n");
    },
  };
}

function summarizeHiddenReasoning(text: string) {
  const normalized = text.toLowerCase();
  if (!normalized.trim()) return undefined;

  if (
    normalized.includes("profile") ||
    normalized.includes("candidate") ||
    normalized.includes("role") ||
    normalized.includes("alex")
  ) {
    return "Mencocokkan pertanyaan dengan konteks profil dan role aktif...";
  }

  if (
    normalized.includes("job") ||
    normalized.includes("recommend") ||
    normalized.includes("match") ||
    normalized.includes("listing")
  ) {
    return "Menimbang rekomendasi dan batas data lowongan yang tersedia...";
  }

  if (
    normalized.includes("respond") ||
    normalized.includes("answer") ||
    normalized.includes("concise")
  ) {
    return "Menyusun jawaban yang ringkas dan relevan...";
  }

  if (
    normalized.includes("user") ||
    normalized.includes("question") ||
    normalized.includes("asking") ||
    normalized.includes("context")
  ) {
    return "Memahami pertanyaan dan konteks percakapan...";
  }

  return "Menganalisis konteks sebelum menjawab...";
}

function parseAiSdkDataEventTypes(chunk: string) {
  const eventTypes: string[] = [];
  for (const line of chunk.split(/\r?\n/)) {
    if (!line.startsWith("data: ")) continue;
    const data = line.slice("data: ".length).trim();
    if (!data || data === "[DONE]") {
      eventTypes.push(data === "[DONE]" ? "done" : "empty");
      continue;
    }
    try {
      const parsed = JSON.parse(data) as { type?: unknown };
      eventTypes.push(
        typeof parsed.type === "string" ? parsed.type : "unknown-json",
      );
    } catch {
      eventTypes.push("invalid-json");
    }
  }
  return eventTypes;
}

function findThinkTag(value: string, kind: "open" | "close") {
  const pattern = kind === "open" ? /<think\b[^>]*>/i : /<\/think>/i;
  const match = pattern.exec(value);
  if (!match) return undefined;
  return { index: match.index, length: match[0].length };
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
      .set({
        "cache-control": "no-cache",
        connection: "keep-alive",
        "content-type": "text/event-stream; charset=utf-8",
        "x-vercel-ai-ui-message-stream": "v1",
      })
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
  const existingSecurityIndicator = securityIndicatorClassifier(request.body);
  if (existingSecurityIndicator.level !== "suspicious") {
    return;
  }

  try {
    const securityGuardDecision = await resolveSecurityGuardDecision(
      request.body,
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
