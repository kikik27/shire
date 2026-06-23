import { ModelRouterEmbeddingModel } from "@mastra/core/llm";
import { embed, embedMany } from "ai";

import { env } from "../../env";

(globalThis as { AI_SDK_LOG_WARNINGS?: boolean }).AI_SDK_LOG_WARNINGS = false;

type RuntimeEnv = typeof env;
type EmbeddingRuntimeConfig = Pick<
  RuntimeEnv,
  "embeddingModels" | "embeddingBaseUrls" | "embeddingProvider"
> & {
  embeddingApiKey?: string;
};

export type EmbeddingCapability =
  | "memory"
  | "product-knowledge"
  | "repository-knowledge";

export interface EmbeddingModelConfig {
  modelId?: string;
  providerId?: string;
  baseUrl?: string;
  apiKey?: string;
}

export function resolveEmbeddingConfig(
  capability: EmbeddingCapability,
  runtime: EmbeddingRuntimeConfig = env,
) {
  if (capability === "memory") {
    return {
      modelId: runtime.embeddingModels.memory,
      providerId: runtime.embeddingProvider,
      baseUrl: runtime.embeddingBaseUrls.memory,
      apiKey: runtime.embeddingApiKey,
    };
  }

  if (capability === "product-knowledge") {
    return {
      modelId: runtime.embeddingModels.productKnowledge,
      providerId: runtime.embeddingProvider,
      baseUrl: runtime.embeddingBaseUrls.productKnowledge,
      apiKey: runtime.embeddingApiKey,
    };
  }

  return {
    modelId: runtime.embeddingModels.repositoryKnowledge,
    providerId: runtime.embeddingProvider,
    baseUrl: runtime.embeddingBaseUrls.repositoryKnowledge,
    apiKey: runtime.embeddingApiKey,
  };
}

export function createEmbeddingModel(
  config: EmbeddingModelConfig = {},
) {
  return new ModelRouterEmbeddingModel({
    providerId: config.providerId ?? env.embeddingProvider,
    modelId: config.modelId ?? env.embeddingModels.default,
    url: config.baseUrl ?? env.embeddingBaseUrls.default,
    apiKey:
      config.apiKey ??
      env.embeddingApiKey ??
      process.env.TOKENROUTER_API_KEY ??
      process.env.OPENROUTER_API_KEY,
  });
}

export function createEmbeddingModelFor(
  capability: EmbeddingCapability,
  runtime: EmbeddingRuntimeConfig = env,
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
