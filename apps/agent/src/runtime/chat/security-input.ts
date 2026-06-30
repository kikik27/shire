import { TRUSTED_CHAT_CONTEXT_SOURCE } from "@shire/shared";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function selectChatSecurityInput(body: unknown) {
  if (
    !isRecord(body) ||
    body.trustedContextSource !== TRUSTED_CHAT_CONTEXT_SOURCE
  ) {
    return body;
  }

  return {
    messages: Array.isArray(body.messages) ? body.messages : [],
  };
}
