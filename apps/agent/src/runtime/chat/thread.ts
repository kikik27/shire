import type { ChatScopeInput } from "./types";

export function buildChatResourceKey(input: ChatScopeInput) {
  if (!input.resourceType || !input.resourceId) {
    return `${input.role}:${input.viewerId}:general`;
  }

  return `${input.role}:${input.viewerId}:${input.resourceType}:${input.resourceId}`;
}

export function buildChatThreadScope(input: ChatScopeInput) {
  const resourceKey = buildChatResourceKey(input);

  return {
    threadId:
      !input.resourceType || !input.resourceId
        ? `${input.role}:${input.viewerId}`
        : resourceKey,
    resourceKey,
  };
}
