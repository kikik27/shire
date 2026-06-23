type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function pickString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

export function summarizeChatRequestBody(body: unknown) {
  if (!isRecord(body)) {
    return { bodyType: typeof body };
  }

  const scope = isRecord(body.scope)
    ? {
        viewerId: pickString(body.scope.viewerId),
        role: pickString(body.scope.role),
        resourceType: pickString(body.scope.resourceType),
        resourceId: pickString(body.scope.resourceId),
        resourceLabel: pickString(body.scope.resourceLabel),
        threadId: pickString(body.scope.threadId),
        resourceKey: pickString(body.scope.resourceKey),
        scope: pickString(body.scope.scope),
      }
    : undefined;

  const memory = isRecord(body.memory)
    ? {
        thread: pickString(body.memory.thread),
        resource: pickString(body.memory.resource),
      }
    : undefined;

  return {
    hasContext: Array.isArray(body.context),
    hasMessages: Array.isArray(body.messages),
    messageCount: Array.isArray(body.messages) ? body.messages.length : undefined,
    systemLength: typeof body.system === "string" ? body.system.length : undefined,
    scope,
    memory,
  };
}
