import { z } from "zod";

export const MATCHING_EVALUATION_STATUSES = [
  "PENDING",
  "RUNNING",
  "COMPLETED",
  "FAILED",
] as const;

export type MatchingEvaluationStatus =
  (typeof MATCHING_EVALUATION_STATUSES)[number];

export const MATCHING_SCORING_VERSION = "matching-v1";

/**
 * Matching pipeline output contract shared by apps/agent (produces it) and
 * apps/web (persists + renders it). Source of truth:
 * .agent/context/schemas/matching-output.md
 *
 * Both job-matching (candidate → job) and talent-matching (job → candidate)
 * produce this shape; the `recommendedAction` discriminator signals which side.
 */
export const MatchingOutputSchema = z.object({
  matchScore: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  reasons: z.array(z.string()),
  missingRequirements: z.array(z.string()).default([]),
  riskFlags: z.array(z.string()).default([]),
  recommendedAction: z.enum([
    "SUGGEST_APPLY",
    "SUGGEST_INVITE",
    "SAVE_ONLY",
    "IGNORE",
  ]),
});

export type MatchingOutput = z.infer<typeof MatchingOutputSchema>;

/**
 * Action thresholds from .agent/context/agent/matching-pipeline.md.
 *   score >= STRONG_THRESHOLD  → notify (status NEW, log for now)
 *   score >= SAVE_THRESHOLD    → save recommendation, show in dashboard
 *   score < SAVE_THRESHOLD     → ignore
 */
export const MATCHING_SAVE_THRESHOLD = 70;
export const MATCHING_STRONG_THRESHOLD = 85;

/**
 * Derive the recommendedAction from a raw match score, scoped by matching
 * direction. Used by the deterministic fallback when the rerank model is not
 * invoked or fails.
 */
export function recommendActionFromScore(
  score: number,
  direction: "candidate-to-job" | "job-to-candidate",
): MatchingOutput["recommendedAction"] {
  if (score < MATCHING_SAVE_THRESHOLD) {
    return "IGNORE";
  }
  if (score < MATCHING_STRONG_THRESHOLD) {
    return "SAVE_ONLY";
  }
  return direction === "candidate-to-job" ? "SUGGEST_APPLY" : "SUGGEST_INVITE";
}
