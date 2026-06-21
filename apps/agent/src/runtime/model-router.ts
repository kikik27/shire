import { env, type createEnv } from "../env";
import type { ChatModelCapability } from "./model-policy";

type RuntimeEnv = ReturnType<typeof createEnv>;

export type ModelRequestContext = {
  capability?: ChatModelCapability;
  runtime?: Pick<RuntimeEnv, "chatModelChains">;
};

export function createModelFallbackChain(models: readonly string[]) {
  return models.map((model) => ({ model, maxRetries: 1 }));
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
    return createModelFallbackChain(runtime.chatModelChains.default);
  }

  return createModelFallbackChain(
    getCapabilityChain(runtime, input.capability),
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
