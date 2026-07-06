import { randomUUID } from "node:crypto";

import { RequestContext } from "@mastra/core/request-context";

import { persistChatTurn } from "../chat/persist-messages";
import type { KnowledgeResult } from "../knowledge";
import {
  buildKnowledgeSystemMessage,
  searchKnowledge,
} from "../knowledge";
import type { ChatModelCapability } from "../models/policy";
import { getCapabilityPolicy } from "../models/policy";
import {
  describeModelForTelemetry,
  resolveModelChain,
} from "../models/router";
import { normalizeModelUsage } from "../models/usage";

type AgentMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

type AgentResponse = {
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  response?: {
    modelId?: string;
  };
  [key: string]: unknown;
};

export async function runAgentWithContext(input: {
  agent: {
    generate: (
      messages: unknown,
      options?: unknown,
    ) => Promise<AgentResponse>;
  };
  capability: ChatModelCapability;
  threadId: string;
  resourceId: string;
  query?: string;
  messages: AgentMessage[];
  search?: (query: string) => Promise<KnowledgeResult[]>;
}) {
  const requestContext = new RequestContext();
  requestContext.set("model-capability", input.capability);

  const search = input.search ?? searchKnowledge;
  const knowledge = input.query?.trim()
    ? await search(input.query.trim())
    : [];
  const messages = knowledge.length
    ? [
        {
          role: "system" as const,
          content: buildKnowledgeSystemMessage(knowledge),
        },
        ...input.messages,
      ]
    : input.messages;

  const startedAt = performance.now();
  const response = await input.agent.generate(messages, {
    requestContext,
    memory: {
      thread: input.threadId,
      resource: input.resourceId,
    },
    maxOutputTokens: getCapabilityPolicy(input.capability).maxOutputTokens,
  });

  // Workaround for @mastra/core 1.49.x not persisting messages on generate().
  // Persist the completed turn (last user message + assistant reply) to the
  // memory substore. Fire-and-forget; persistChatTurn swallows storage errors.
  void persistJobTurn(input.messages, response, input.threadId, input.resourceId);

  const configuredModel = describeModelForTelemetry(
    resolveModelChain({
      capability: input.capability,
    })[0].model,
  );

  return {
    response,
    usage: normalizeModelUsage({
      runId: randomUUID(),
      capability: input.capability,
      model: response.response?.modelId ?? configuredModel,
      usage: response.usage,
      latencyMs: Math.round(performance.now() - startedAt),
      retryCount: 0,
    }),
  };
}

/**
 * Persist a completed job (non-chat) agent turn to memory. Mirrors the chat
 * path workaround in routes/chat.middleware.ts. Lazy-imports the memory
 * singleton to avoid eager libSQL init during tests that inject a mock agent.
 */
async function persistJobTurn(
  messages: AgentMessage[],
  response: AgentResponse,
  threadId: string,
  resourceId: string,
): Promise<void> {
  const assistantText =
    typeof response.text === "string" ? response.text : undefined;
  if (!assistantText) return;

  try {
    const { agentMemory } = await import("../memory");
    const memoryStore = await (
      agentMemory as unknown as {
        getMemoryStore: () => Promise<{
          saveThread: (args: unknown) => Promise<unknown>;
          saveMessages: (args: { messages: unknown[] }) => Promise<unknown>;
        }>;
      }
    ).getMemoryStore();
    await persistChatTurn({
      memoryStore,
      thread: threadId,
      resource: resourceId,
      userMessages: messages,
      assistantText,
    });
  } catch {
    // persistChatTurn already logs; swallow double to keep this helper safe.
  }
}
