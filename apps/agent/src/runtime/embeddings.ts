import { ModelRouterEmbeddingModel } from "@mastra/core/llm";
import { embed, embedMany } from "ai";

import { env } from "../env";

(globalThis as { AI_SDK_LOG_WARNINGS?: boolean }).AI_SDK_LOG_WARNINGS = false;

type RuntimeEnv = typeof env;

export type EmbeddingCapability =
  | "memory"
  | "product-knowledge"
  | "repository-knowledge";

export interface EmbeddingModelConfig {
  modelId?: string;
  baseUrl?: string;
  apiKey?: string;
}

export function resolveEmbeddingConfig(
  capability: EmbeddingCapability,
  runtime: Pick<RuntimeEnv, "embeddingModels" | "embeddingBaseUrls"> = env,
) {
  if (capability === "memory") {
    return {
      modelId: runtime.embeddingModels.memory,
      baseUrl: runtime.embeddingBaseUrls.memory,
    };
  }

  if (capability === "product-knowledge") {
    return {
      modelId: runtime.embeddingModels.productKnowledge,
      baseUrl: runtime.embeddingBaseUrls.productKnowledge,
    };
  }

  return {
    modelId: runtime.embeddingModels.repositoryKnowledge,
    baseUrl: runtime.embeddingBaseUrls.repositoryKnowledge,
  };
}

export function createEmbeddingModel(
  config: EmbeddingModelConfig = {},
) {
  return new ModelRouterEmbeddingModel({
    providerId: "openrouter",
    modelId: config.modelId ?? env.embeddingModels.default,
    url: config.baseUrl ?? env.embeddingBaseUrls.default,
    apiKey: config.apiKey ?? process.env.OPENROUTER_API_KEY,
  });
}

export function createEmbeddingModelFor(
  capability: EmbeddingCapability,
  runtime: Pick<RuntimeEnv, "embeddingModels" | "embeddingBaseUrls"> = env,
) {
  return createEmbeddingModel(resolveEmbeddingConfig(capability, runtime));
}

export async function embedText(value: string) {
  return embed({
    model: createEmbeddingModelFor("repository-knowledge"),
    value,
  });
}

export async function embedTexts(values: string[]) {
  return embedMany({
    model: createEmbeddingModelFor("repository-knowledge"),
    values,
  });
}

export async function embedTextFor(
  capability: EmbeddingCapability,
  value: string,
) {
  return embed({
    model: createEmbeddingModelFor(capability),
    value,
  });
}

export async function embedTextsFor(
  capability: EmbeddingCapability,
  values: string[],
) {
  return embedMany({
    model: createEmbeddingModelFor(capability),
    values,
  });
}
