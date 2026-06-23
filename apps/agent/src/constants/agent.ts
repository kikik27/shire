export const ROLE_AWARE_CHAT_AGENT_ID = "role-aware-chat-agent";
export const CHAT_ROUTE_PATTERN = "/chat/:agentId";
export const CHAT_STREAM_STALL_TIMEOUT_MS = 5_000;

export const RUNTIME_HTTP_ROUTES = [
  "/health",
  "/ready",
  "/jobs",
  "/jobs/cv-document",
  "/jobs/:jobId",
  "/product-qna",
  CHAT_ROUTE_PATTERN,
] as const;

export const AI_SDK_STREAM_HEADERS = {
  "cache-control": "no-cache",
  connection: "keep-alive",
  "content-type": "text/event-stream; charset=utf-8",
  "x-vercel-ai-ui-message-stream": "v1",
} as const;
