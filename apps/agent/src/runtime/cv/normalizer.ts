import { randomUUID } from "node:crypto";

import {
  CandidateProfileDraftSchema,
  buildCandidateEmbeddingText,
} from "./candidate-profile";
import type { CandidateProfileStore } from "../data/candidate-profile-store";
import { normalizeModelUsage } from "../models/usage";

export type CvGenerationResult = {
  profile: unknown;
  model: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
};

export async function normalizeCvWithFallback(input: {
  rawCv: string;
  generate: (request: {
    rawCv: string;
  }) => Promise<CvGenerationResult>;
}) {
  const attempts: Array<{ attempt: number; error?: string }> = [];
  let lastError: unknown;

  for (const attempt of [1, 2, 3] as const) {
    try {
      const result = await input.generate({ rawCv: input.rawCv });
      const profile = CandidateProfileDraftSchema.parse(result.profile);
      return { profile, result, attempts };
    } catch (error) {
      lastError = error;
      attempts.push({
        attempt,
        error:
          error instanceof Error
            ? error.message
            : "Unknown CV normalization error",
      });
    }
  }

  throw new Error(`CV normalization exhausted ${attempts.length} attempts`, {
    cause: lastError,
  });
}

export function sanitizeCvText(rawCv: string) {
  return rawCv
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function processCandidateCv(input: {
  candidateId: string;
  rawCv: string;
  store: CandidateProfileStore;
  generate: (request: {
    rawCv: string;
  }) => Promise<CvGenerationResult>;
  embed: (value: string) => Promise<{ embedding: number[] }>;
}) {
  const sanitizedCv = sanitizeCvText(input.rawCv);
  const startedAt = performance.now();
  const normalized = await normalizeCvWithFallback({
    rawCv: sanitizedCv,
    generate: input.generate,
  });
  const embeddingText = buildCandidateEmbeddingText(normalized.profile);
  const { embedding } = await input.embed(embeddingText);
  const usage = normalizeModelUsage({
    runId: randomUUID(),
    capability: "cv-normalization",
    model: normalized.result.model,
    usage: normalized.result.usage,
    latencyMs: Math.round(performance.now() - startedAt),
    retryCount: normalized.attempts.length,
    escalationReason:
      normalized.attempts.length >= 2
        ? "schema-validation-failure"
        : undefined,
  });
  const record = {
    id: input.candidateId,
    status: "PENDING_REVIEW" as const,
    profile: normalized.profile,
    embeddingText,
    embedding,
    usage: [usage],
  };

  await input.store.saveDraft(record);

  return record;
}
