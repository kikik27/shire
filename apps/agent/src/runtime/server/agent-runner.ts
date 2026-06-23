import { randomUUID } from "node:crypto";

import { RequestContext } from "@mastra/core/request-context";

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
