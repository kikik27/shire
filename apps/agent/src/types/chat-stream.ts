export type ChatStreamFinishReason = "finish" | "close" | "error";

export type HiddenReasoningStreamSanitizer = {
  sanitize: (chunk: unknown) => unknown;
  flush: () => string;
};
