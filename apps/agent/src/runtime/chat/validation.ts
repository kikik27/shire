type UnknownRecord = Record<string, unknown>;

export type ChatValidationResult =
  | { valid: true; latestUserText: string; messageCount: number; bodyBytes: number }
  | {
      valid: false;
      reasonCode:
        | "invalid-body"
        | "missing-user-message"
        | "body-too-large"
        | "too-many-messages"
        | "message-too-long"
        | "invalid-scope";
    };

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function extractLatestUserText(body: UnknownRecord) {
  if (!isRecord(body) || !Array.isArray(body.messages)) {
    return undefined;
  }

  for (let index = body.messages.length - 1; index >= 0; index -= 1) {
    const message = body.messages[index];
    if (!isRecord(message) || message.role !== "user") {
      continue;
    }

    if (typeof message.content === "string") {
      return message.content.trim();
    }

    if (Array.isArray(message.parts)) {
      return message.parts
        .filter(
          (part): part is UnknownRecord =>
            isRecord(part) &&
            part.type === "text" &&
            typeof part.text === "string",
        )
        .map((part) => String(part.text))
        .join("")
        .trim();
    }

    return "";
  }

  return undefined;
}

export function validateChatRequest(
  body: unknown,
  options: {
    maxBodyBytes: number;
    maxMessages: number;
    maxMessageCharacters: number;
  },
): ChatValidationResult {
  // Check if body is a valid record
  if (!isRecord(body)) {
    return { valid: false, reasonCode: "invalid-body" };
  }

  // Calculate body size
  const bodyBytes = Buffer.byteLength(JSON.stringify(body), "utf8");
  if (bodyBytes > options.maxBodyBytes) {
    return { valid: false, reasonCode: "body-too-large" };
  }

  // Check messages array
  if (!Array.isArray(body.messages)) {
    return { valid: false, reasonCode: "invalid-body" };
  }

  const messageCount = body.messages.length;
  if (messageCount === 0) {
    return { valid: false, reasonCode: "missing-user-message" };
  }

  if (messageCount > options.maxMessages) {
    return { valid: false, reasonCode: "too-many-messages" };
  }

  // Extract and validate latest user message
  const latestUserText = extractLatestUserText(body);
  if (latestUserText === undefined) {
    return { valid: false, reasonCode: "missing-user-message" };
  }

  if (latestUserText.length === 0) {
    return { valid: false, reasonCode: "missing-user-message" };
  }

  if (latestUserText.length > options.maxMessageCharacters) {
    return { valid: false, reasonCode: "message-too-long" };
  }

  // Validate scope (if present)
  if (isRecord(body.scope)) {
    const scope = body.scope;
    if (
      typeof scope.viewerId !== "string" ||
      (scope.role !== "candidate" && scope.role !== "recruiter")
    ) {
      return { valid: false, reasonCode: "invalid-scope" };
    }
    // resourceType and resourceId are optional
  }

  return {
    valid: true,
    latestUserText,
    messageCount,
    bodyBytes,
  };
}
