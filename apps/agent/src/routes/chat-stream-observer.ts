import type { Request, Response } from "express";

import { CHAT_STREAM_STALL_TIMEOUT_MS } from "../constants/agent";
import {
  normalizeChunk,
  parseAiSdkDataEventTypes,
} from "../lib/sse";
import { logger } from "../runtime/logger";
import { createAiSdkHiddenReasoningStreamSanitizer } from "../runtime/chat/stream-sanitizer";
import type { ChatStreamFinishReason } from "../types/chat-stream";

const chatLogger = logger.child({ component: "chat-middleware" });

export function observeChatStream(
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
    }, CHAT_STREAM_STALL_TIMEOUT_MS);
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
    finish(reason: ChatStreamFinishReason, error?: Error) {
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
