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

export interface ProductQnaRouteDependencies {
  serviceToken?: string;
  rateLimiter: RateLimiter;
  now?: () => number;
  answerProductQuestion?: typeof answerProductQuestion;
}

/** Mounts POST /product-qna — public product Q&A with per-caller rate limiting. */
export function mountProductQnaRoute(
  app: Express,
  dependencies: ProductQnaRouteDependencies,
) {
  const isAuthorized = (request: { header: (name: string) => string | undefined }) =>
    hasValidServiceToken(request.header("authorization"), dependencies.serviceToken);

  app.post("/product-qna", async (request, response) => {
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

      const answer = await (dependencies.answerProductQuestion ??
        answerProductQuestion)(request.body);
      response.json(answer);
    } catch (error) {
      if (error instanceof ProductQnaError) {
        response.status(400).json({
          status: error.code,
          message: error.message,
        });
        return;
      }

      qnaLogger.error({ err: error }, "product Q&A failed");
      response.status(502).json({ status: "product-qna-unavailable" });
    }
  });
}
