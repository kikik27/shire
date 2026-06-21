export type ChatModelCapability =
  | "product-qna"
  | "role-aware-chat"
  | "cv-normalization"
  | "knowledge-synthesis"
  | "job-rerank"
  | "talent-rerank"
  | "recommendation-explanation"
  | "workflow-summary"
  | "dispute-summary"
  | "security-guard";

export type CapabilityPolicy = {
  maxOutputTokens: number;
  confidenceThreshold?: number;
};

const policies: Record<ChatModelCapability, CapabilityPolicy> = {
  "product-qna": { maxOutputTokens: 700 },
  "role-aware-chat": { maxOutputTokens: 1_000 },
  "cv-normalization": {
    maxOutputTokens: 1_500,
    confidenceThreshold: 0.7,
  },
  "knowledge-synthesis": { maxOutputTokens: 700 },
  "job-rerank": { maxOutputTokens: 700 },
  "talent-rerank": { maxOutputTokens: 700 },
  "recommendation-explanation": { maxOutputTokens: 500 },
  "workflow-summary": { maxOutputTokens: 500 },
  "dispute-summary": { maxOutputTokens: 2_000 },
  "security-guard": { maxOutputTokens: 500 },
};

export function getCapabilityPolicy(capability: ChatModelCapability) {
  return policies[capability];
}

export function shouldEscalate(input: {
  capability: ChatModelCapability;
  schemaFailureCount: number;
  confidence?: number;
}) {
  const policy = getCapabilityPolicy(input.capability);

  return (
    input.schemaFailureCount >= 2 ||
    (input.schemaFailureCount === 0 &&
      policy.confidenceThreshold !== undefined &&
      input.confidence !== undefined &&
      input.confidence < policy.confidenceThreshold)
  );
}
