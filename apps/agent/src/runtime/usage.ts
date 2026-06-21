import type { ChatModelCapability } from "./model-policy";

export type ModelUsageRecord = {
  runId: string;
  capability: ChatModelCapability;
  provider: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  latencyMs: number;
  retryCount: number;
  escalationReason?: string;
};

export function normalizeModelUsage(input: {
  runId: string;
  capability: ChatModelCapability;
  model: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  latencyMs: number;
  retryCount: number;
  escalationReason?: string;
}): ModelUsageRecord {
  const record: ModelUsageRecord = {
    runId: input.runId,
    capability: input.capability,
    provider: input.model.split("/", 1)[0],
    model: input.model,
    inputTokens: input.usage?.inputTokens,
    outputTokens: input.usage?.outputTokens,
    totalTokens: input.usage?.totalTokens,
    latencyMs: input.latencyMs,
    retryCount: input.retryCount,
  };

  if (input.escalationReason !== undefined) {
    record.escalationReason = input.escalationReason;
  }

  return record;
}
