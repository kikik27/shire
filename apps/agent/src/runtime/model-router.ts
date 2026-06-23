import { env, type createEnv } from "../env";
import type { ChatModelCapability } from "./model-policy";

type RuntimeEnv = ReturnType<typeof createEnv>;
type TextModelRuntime = Pick<
  RuntimeEnv,
  "textModelProvider" | "textModelBaseUrl" | "textModelApiKey"
>;

export type ModelRequestContext = {
  capability?: ChatModelCapability;
  runtime?: Pick<
    RuntimeEnv,
    | "chatModelChains"
    | "textModelProvider"
    | "textModelBaseUrl"
    | "textModelApiKey"
  >;
};

/**
 * OpenAI-compatible model config. When `url` + `apiKey` are present, Mastra
 * routes requests directly to that endpoint instead of through its built-in
 * provider gateway. This lets us point chat models at TokenRouter (serving
 * MiniMax-M3) while embeddings stay on OpenRouter.
 *
 * Matches Mastra's `OpenAICompatibleConfig` variant of `MastraModelConfig`.
 */
export type ModelConfig = {
  providerId: string;
  modelId: string;
  url?: string;
  apiKey?: string;
};

function toModelConfig(
  model: string,
  runtime: TextModelRuntime,
): ModelConfig {
  const normalizedModel = model.trim();
  const slashIndex = normalizedModel.indexOf("/");
  const providerId =
    slashIndex > 0
      ? normalizedModel.slice(0, slashIndex)
      : runtime.textModelProvider;
  const modelId =
    slashIndex > 0
      ? normalizedModel.slice(slashIndex + 1)
      : normalizedModel;

  return {
    providerId,
    modelId,
    // Always carry url + apiKey so Mastra treats this as OpenAI-compatible
    // (direct routing) rather than a registered-gateway provider lookup.
    url: runtime.textModelBaseUrl,
    apiKey: runtime.textModelApiKey,
  };
}

export function describeModelForTelemetry(model: string | ModelConfig) {
  if (typeof model === "string") {
    return model;
  }

  return `${model.providerId}/${model.modelId}`;
}

export function createModelFallbackChain(
  models: readonly string[],
  runtime: TextModelRuntime = env,
) {
  return models.map((model) => ({
    model: toModelConfig(model, runtime),
    maxRetries: 1,
  }));
}

function toEnvCapabilityKey(capability: ChatModelCapability) {
  switch (capability) {
    case "product-qna":
      return "productQna";
    case "role-aware-chat":
      return "roleAwareChat";
    case "cv-normalization":
      return "cvNormalization";
    case "knowledge-synthesis":
      return "knowledgeSynthesis";
    case "job-rerank":
      return "jobRerank";
    case "talent-rerank":
      return "talentRerank";
    case "recommendation-explanation":
      return "recommendationExplanation";
    case "workflow-summary":
      return "workflowSummary";
    case "dispute-summary":
      return "disputeSummary";
    case "security-guard":
      return "securityGuard";
  }
}

function getCapabilityChain(
  runtime: Pick<RuntimeEnv, "chatModelChains">,
  capability: ChatModelCapability,
) {
  const key = toEnvCapabilityKey(capability);
  return runtime.chatModelChains[key] ?? runtime.chatModelChains.default;
}

export function resolveModelChain(input: ModelRequestContext) {
  const runtime = input.runtime ?? env;
  if (!input.capability) {
    return createModelFallbackChain(runtime.chatModelChains.default, runtime);
  }

  return createModelFallbackChain(
    getCapabilityChain(runtime, input.capability),
    runtime,
  );
}

export function resolveRuntimeAgentModelId(input: ModelRequestContext = {}) {
  const runtime = input.runtime ?? env;
  if (!input.capability) {
    return runtime.chatModelChains.default[0];
  }

  return getCapabilityChain(runtime, input.capability)[0];
}

export const dynamicAgentModel = ({
  requestContext,
}: {
  requestContext: { get: (key: string) => unknown };
}) => {
  const capability = requestContext.get("model-capability") as
    | ChatModelCapability
    | undefined;

  return resolveModelChain({ capability });
};
