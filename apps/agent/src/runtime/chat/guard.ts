export type ChatGuardDecision =
  | { decision: "allow"; messageLength: number }
  | {
      decision: "prompt-injection" | "out-of-scope";
      messageLength: number;
    };

export type BlockedChatGuardDecision = Exclude<
  ChatGuardDecision,
  { decision: "allow" }
>;

import { classifySecurityIndicator } from "../security/indicators";

export const PROMPT_INJECTION_RESPONSE =
  "I can't follow instructions that attempt to override my rules or access protected context. I can only assist with Shire-related recruitment and employment topics.";

export const OUT_OF_SCOPE_RESPONSE =
  "I can only assist with Shire-related topics, including jobs, candidates, applications, recruiting, matching, profiles, and platform usage.";

export function extractLatestUserText(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return undefined;
  }

  const record = body as Record<string, unknown>;
  if (!Array.isArray(record.messages)) {
    return undefined;
  }

  for (let index = record.messages.length - 1; index >= 0; index -= 1) {
    const message = record.messages[index];
    if (!message || typeof message !== "object" || Array.isArray(message)) {
      continue;
    }

    const messageRecord = message as Record<string, unknown>;
    if (messageRecord.role !== "user") {
      continue;
    }

    if (typeof messageRecord.content === "string") {
      const text = messageRecord.content.trim();
      return text || undefined;
    }

    if (!Array.isArray(messageRecord.parts)) {
      return undefined;
    }

    const text = messageRecord.parts
      .filter(
        (part): part is Record<string, unknown> =>
          Boolean(part) &&
          typeof part === "object" &&
          !Array.isArray(part) &&
          part.type === "text" &&
          typeof part.text === "string",
      )
      .map((part) => String(part.text))
      .join("")
      .trim();

    return text || undefined;
  }

  return undefined;
}

export function classifyChatRequest(body: unknown): ChatGuardDecision {
  const text = extractLatestUserText(body);
  const messageLength = text?.length ?? 0;

  if (!text) {
    return { decision: "out-of-scope", messageLength };
  }

  const indicator = classifySecurityIndicator(body);
  if (indicator.level === "blocked") {
    return { decision: "prompt-injection", messageLength };
  }

  return { decision: "allow", messageLength };
}

export function createChatFallbackStream(decision: BlockedChatGuardDecision) {
  const messageId = `guard-${crypto.randomUUID()}`;
  const textId = `text-${crypto.randomUUID()}`;
  const text =
    decision.decision === "prompt-injection"
      ? PROMPT_INJECTION_RESPONSE
      : OUT_OF_SCOPE_RESPONSE;
  const events = [
    { type: "start", messageId },
    { type: "start-step" },
    { type: "text-start", id: textId },
    { type: "text-delta", id: textId, delta: text },
    { type: "text-end", id: textId },
    { type: "finish-step" },
    { type: "finish" },
  ];

  return `${events
    .map((event) => `data: ${JSON.stringify(event)}\n\n`)
    .join("")}data: [DONE]\n\n`;
}
