import type { Express } from "express";

import { env } from "../env";
import { logger } from "../runtime/logger";
import { enforceChatRateLimit } from "../runtime/chat-caller";
import {
  answerProductQuestion,
  ProductQnaError,
} from "../runtime/product-qna";
import { hasValidServiceToken } from "../runtime/internal-auth";
import type { RateLimiter } from "../runtime/rate-limit";

const qnaLogger = logger.child({ component: "product-qna-route" });
const PRODUCT_QNA_TIMEOUT_MS = 20_000;

export interface ProductQnaRouteDependencies {
  serviceToken?: string;
  rateLimiter: RateLimiter;
  now?: () => number;
  answerProductQuestion?: typeof answerProductQuestion;
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

      const answer = await withTimeout(
        (dependencies.answerProductQuestion ?? answerProductQuestion)(
          request.body,
        ),
        timeoutMs,
      );
      qnaLogger.info(
        {
          durationMs: Date.now() - startedAt,
          knowledgePathCount: answer.knowledgePaths.length,
        },
        "product Q&A request completed",
      );
      response.json(answer);
    } catch (error) {
      if (error instanceof ProductQnaError) {
        response.status(400).json({
          status: error.code,
          message: error.message,
        });
        return;
      }

      if (error instanceof ProductQnaTimeoutError) {
        qnaLogger.error(
          {
            err: error,
            durationMs: Date.now() - startedAt,
            timeoutMs,
          },
          "product Q&A timed out",
        );
        response.status(504).json({ status: "product-qna-timeout" });
        return;
      }

      qnaLogger.error({ err: error }, "product Q&A failed");
      response.status(502).json({ status: "product-qna-unavailable" });
    }
  });
}

class ProductQnaTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Product Q&A timed out after ${timeoutMs}ms.`);
    this.name = "ProductQnaTimeoutError";
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timeout: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new ProductQnaTimeoutError(timeoutMs));
    }, timeoutMs);
    timeout.unref?.();
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeout) {
      clearTimeout(timeout);
    }
  });
}
