import type { Express } from "express";

import { env } from "../env";
import { logger } from "../runtime/logger";
import { enforceChatRateLimit } from "../runtime/chat/caller";
import { ProductQnaError } from "../runtime/knowledge/product-qna";
import { streamProductQuestion } from "../runtime/knowledge/product-qna-stream";
import { createAiSdkHiddenReasoningStreamSanitizer } from "../runtime/chat/stream-sanitizer";
import { hasValidServiceToken } from "../runtime/auth/internal";
import type { RateLimiter } from "../runtime/auth/rate-limit";

const qnaLogger = logger.child({ component: "product-qna-route" });
const PRODUCT_QNA_TIMEOUT_MS = 20_000;

export interface ProductQnaRouteDependencies {
  serviceToken?: string;
  rateLimiter: RateLimiter;
  now?: () => number;
  streamProductQuestion?: typeof streamProductQuestion;
  timeoutMs?: number;
}

/** Mounts POST /product-qna, public product Q&A with per-caller rate limiting. */
export function mountProductQnaRoute(
  app: Express,
  dependencies: ProductQnaRouteDependencies,
) {
  const timeoutMs = dependencies.timeoutMs ?? PRODUCT_QNA_TIMEOUT_MS;
  const isAuthorized = (request: { header: (name: string) => string | undefined }) =>
    hasValidServiceToken(request.header("authorization"), dependencies.serviceToken);

  app.post("/product-qna", async (request, response) => {
    const startedAt = Date.now();
    if (!isAuthorized(request)) {
      response.status(401).json({ status: "unauthorized" });
      return;
    }

    const controller = new AbortController();
    const abortFromClient = () => controller.abort(new Error("client-aborted"));
    request.once("aborted", abortFromClient);
    response.once("close", () => {
      if (!response.writableEnded) abortFromClient();
    });
    const timeout = setTimeout(() => {
      controller.abort(new ProductQnaTimeoutError(timeoutMs));
    }, timeoutMs);
    timeout.unref?.();

    try {
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
        qnaLogger.warn(
          {
            callerKey: rateResult.callerKey,
            retryAfterSeconds: rateResult.retryAfterSeconds,
          },
          "product Q&A request rate limited",
        );
        response
          .status(429)
          .set("retry-after", rateResult.retryAfterSeconds.toString())
          .json({ status: "rate-limited" });
        return;
      }

      qnaLogger.info(
        {
          callerKey: rateResult.callerKey,
          questionLength:
            typeof request.body?.question === "string"
              ? request.body.question.trim().length
              : undefined,
        },
        "product Q&A request accepted",
      );

      const upstream = await waitForStream(
        Promise.resolve(
          (dependencies.streamProductQuestion ?? streamProductQuestion)(
            request.body,
            controller.signal,
          ),
        ),
        controller.signal,
      );
      response
        .status(upstream.status)
        .set(
          "content-type",
          upstream.headers.get("content-type") ?? "text/event-stream",
        )
        .set("cache-control", "no-cache, no-transform");
      await pipeProductStream(upstream, response);
      qnaLogger.info(
        {
          durationMs: Date.now() - startedAt,
        },
        "product Q&A request completed",
      );
    } catch (error) {
      if (error instanceof ProductQnaError) {
        response.status(400).json({
          status: error.code,
          message: error.message,
        });
        return;
      }

      const abortReason = controller.signal.reason;
      if (
        error instanceof ProductQnaTimeoutError ||
        abortReason instanceof ProductQnaTimeoutError
      ) {
        qnaLogger.error(
          {
            err: error,
            durationMs: Date.now() - startedAt,
            timeoutMs,
          },
          "product Q&A timed out",
        );
        if (!response.headersSent) {
          response.status(504).json({ status: "product-qna-timeout" });
        } else {
          response.end();
        }
        return;
      }

      if (!controller.signal.aborted) {
        qnaLogger.error({ err: error }, "product Q&A failed");
      }
      if (!response.headersSent) {
        response.status(502).json({ status: "product-qna-unavailable" });
      } else {
        response.end();
      }
    } finally {
      clearTimeout(timeout);
      request.off("aborted", abortFromClient);
    }
  });
}

class ProductQnaTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Product Q&A timed out after ${timeoutMs}ms.`);
    this.name = "ProductQnaTimeoutError";
  }
}

function waitForStream<T>(promise: Promise<T>, signal: AbortSignal) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      if (signal.aborted) {
        reject(signal.reason);
        return;
      }
      signal.addEventListener("abort", () => reject(signal.reason), {
        once: true,
      });
    }),
  ]);
}

async function pipeProductStream(
  upstream: Response,
  response: import("express").Response,
) {
  if (!upstream.body) {
    response.end();
    return;
  }
  const sanitizer = createAiSdkHiddenReasoningStreamSanitizer();
  const reader = upstream.body.getReader();
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      const sanitized = sanitizer.sanitize(chunk.value);
      if (sanitized) response.write(sanitized);
    }
    const final = sanitizer.flush();
    if (final) response.write(final);
    response.end();
  } finally {
    reader.releaseLock();
  }
}
