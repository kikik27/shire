import { and, eq, inArray, ne, or, sql } from "drizzle-orm";
import {
  MATCHING_SCORING_VERSION,
  type MatchingOutput,
} from "@shire/shared";

import type { AgentDatabase } from "../db/client";
import {
  agentRuns,
  applications,
  candidateProfiles,
  jobs,
  matchingEvaluations,
  recommendations,
} from "../db/schema";
import {
  type CandidateMatchInput,
  type JobMatchInput,
  type MatchingEvaluation,
  type MatchingRepository,
  matchingPairKey,
  type RecommendationSnapshot,
} from "./types";

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string");
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    const text = asString(value);
    if (text) {
      return text;
    }
  }
  return undefined;
}

function webExperienceLevelToYears(value: unknown) {
  const level = asString(value)?.toUpperCase();
  if (level === "INTERN") return 0;
  if (level === "JUNIOR") return 1;
  if (level === "MID") return 3;
  if (level === "SENIOR") return 5;
  if (level === "LEAD") return 8;
  return undefined;
}

function parseSalaryExpectation(value: unknown) {
  const text = asString(value);
  if (!text) {
    return undefined;
  }

  const matches = text.toLowerCase().match(/(\d+(\.\d+)?)(k)?/g) ?? [];
  const values = matches.map((match) => {
    const numeric = Number(match.replace(/k$/, ""));
    return match.endsWith("k") ? numeric * 1000 : numeric;
  });
  if (values.length === 0) {
    return undefined;
  }

  const [min, max] = values;
  return { min, max, currency: undefined };
}

/** Extract the structured fields the scorer reads from the loose profile jsonb. */
export function mapCandidateProfileForMatching(
  row: Pick<
    typeof candidateProfiles.$inferSelect,
    "profile" | "profileStatus" | "userId"
  >,
): CandidateMatchInput {
  const profile = (row.profile ?? {}) as Record<string, unknown>;
  const salary = profile.expectedSalary as Record<string, unknown> | undefined;
  const webSalary = parseSalaryExpectation(profile.salaryExpectation);

  return {
    userId: row.userId,
    fullName: firstString(profile.fullName, profile.displayName),
    headline: firstString(profile.headline, profile.bio),
    summary: firstString(profile.summary, profile.bio),
    skills: asStringArray(profile.skills),
    preferredRoles:
      asStringArray(profile.preferredRoles).length > 0
        ? asStringArray(profile.preferredRoles)
        : asStringArray(profile.roleTargets),
    expectedSalary: salary
      ? {
          min: asNumber(salary.min),
          max: asNumber(salary.max),
          currency: asString(salary.currency),
        }
      : webSalary,
    location: asString(profile.location),
    workPreference: asString(profile.workPreference),
    portfolioUrl: asString(profile.portfolioUrl),
    githubUrl: asString(profile.githubUrl),
    linkedinUrl: asString(profile.linkedinUrl),
    yearsExperience:
      asNumber(profile.yearsExperience) ??
      webExperienceLevelToYears(profile.experienceLevel),
    profileStatus: row.profileStatus,
  };
}

function mapJob(row: typeof jobs.$inferSelect): JobMatchInput {
  return {
    id: row.id,
    recruiterUserId: row.recruiterUserId,
    title: row.title,
    description: row.description,
    companyName: row.companyName,
    location: row.location,
    remote: row.remote,
    salaryRange: row.salaryRange,
    jobType: row.jobType,
    experienceLevel: row.experienceLevel,
    skillsRequired: row.skillsRequired,
    status: row.status,
    riskLevel: row.riskLevel,
    riskScore: row.riskScore,
  };
}

function mapEvaluation(
  row: typeof matchingEvaluations.$inferSelect,
): MatchingEvaluation {
  return {
    ...row,
    recommendedAction: asRecommendedAction(row.recommendedAction),
    reasons: row.reasons ?? [],
    missingRequirements: row.missingRequirements ?? [],
    riskFlags: row.riskFlags ?? [],
  };
}

function asRecommendedAction(
  value: string | null,
): MatchingOutput["recommendedAction"] | null {
  return value === "SUGGEST_APPLY" ||
    value === "SUGGEST_INVITE" ||
    value === "SAVE_ONLY" ||
    value === "IGNORE"
    ? value
    : null;
}

export function createDrizzleMatchingRepository(
  database: AgentDatabase,
): MatchingRepository {
  return {
    async getCandidateProfile(userId) {
      const [row] = await database
        .select()
        .from(candidateProfiles)
        .where(eq(candidateProfiles.userId, userId))
        .limit(1);
      if (!row || row.profileStatus !== "CONFIRMED") {
        return null;
      }
      return mapCandidateProfileForMatching(row);
    },

    async listConfirmedCandidates() {
      const rows = await database
        .select()
        .from(candidateProfiles)
        .where(eq(candidateProfiles.profileStatus, "CONFIRMED"));
      return rows.map(mapCandidateProfileForMatching);
    },

    async listActiveJobs(options) {
      const rows = await database
        .select()
        .from(jobs)
        .where(
          options?.excludeRecruiterUserId
            ? and(
                eq(jobs.status, "ACTIVE"),
                ne(jobs.recruiterUserId, options.excludeRecruiterUserId),
              )
            : eq(jobs.status, "ACTIVE"),
        );
      return rows.map(mapJob);
    },

    async getActiveJob(jobId) {
      const [row] = await database
        .select()
        .from(jobs)
        .where(and(eq(jobs.id, jobId), eq(jobs.status, "ACTIVE")))
        .limit(1);
      return row ? mapJob(row) : null;
    },

    async listAppliedJobIds(candidateUserId) {
      const rows = await database
        .select({ jobId: applications.jobId })
        .from(applications)
        .where(eq(applications.candidateUserId, candidateUserId));
      return new Set(rows.map((row) => row.jobId));
    },

    async getRecommendation(candidateUserId, jobId, type) {
      const [row] = await database
        .select({ id: recommendations.id })
        .from(recommendations)
        .where(
          and(
            eq(recommendations.candidateUserId, candidateUserId),
            eq(recommendations.jobId, jobId),
            eq(recommendations.type, type),
          ),
        )
        .limit(1);
      return row ? { id: row.id } : null;
    },

    async saveRecommendation(input) {
      const values = {
        type: input.type,
        candidateUserId: input.candidateUserId,
        recruiterUserId: input.recruiterUserId,
        jobId: input.jobId,
        matchScore: input.matchScore,
        confidence: String(input.confidence),
        reasons: input.reasons,
        missingRequirements: input.missingRequirements,
        riskFlags: input.riskFlags,
        recommendedAction: input.recommendedAction,
        status: "NEW" as const,
        updatedAt: new Date(),
      };

      const [row] = await database
        .insert(recommendations)
        .values(values)
        .onConflictDoUpdate({
          target: [
            recommendations.candidateUserId,
            recommendations.jobId,
            recommendations.type,
          ],
          set: {
            recruiterUserId: values.recruiterUserId,
            matchScore: values.matchScore,
            confidence: values.confidence,
            reasons: values.reasons,
            missingRequirements: values.missingRequirements,
            riskFlags: values.riskFlags,
            recommendedAction: values.recommendedAction,
            status: "NEW",
            updatedAt: values.updatedAt,
          },
        })
        .returning({ id: recommendations.id });
      return row!.id;
    },

    async deactivateRecommendations(pair) {
      const rows = await database
        .update(recommendations)
        .set({ status: "EXPIRED", updatedAt: new Date() })
        .where(
          and(
            eq(recommendations.candidateUserId, pair.candidateUserId),
            eq(recommendations.jobId, pair.jobId),
            ne(recommendations.status, "EXPIRED"),
          ),
        )
        .returning({ id: recommendations.id });
      return rows.length;
    },

    async deactivateIneligiblePairs(activePairs) {
      const rows = await database
        .select({
          id: recommendations.id,
          candidateUserId: recommendations.candidateUserId,
          jobId: recommendations.jobId,
        })
        .from(recommendations)
        .where(ne(recommendations.status, "EXPIRED"));
      const staleIds = rows
        .filter(
          (row) =>
            row.jobId !== null &&
            !activePairs.has(
              matchingPairKey({
                candidateUserId: row.candidateUserId,
                jobId: row.jobId,
              }),
            ),
        )
        .map((row) => row.id);
      if (staleIds.length === 0) {
        return 0;
      }
      const expired = await database
        .update(recommendations)
        .set({ status: "EXPIRED", updatedAt: new Date() })
        .where(inArray(recommendations.id, staleIds))
        .returning({ id: recommendations.id });
      return expired.length;
    },

    async getEvaluation(pair) {
      const [row] = await database
        .select()
        .from(matchingEvaluations)
        .where(
          and(
            eq(matchingEvaluations.candidateUserId, pair.candidateUserId),
            eq(matchingEvaluations.jobId, pair.jobId),
          ),
        )
        .limit(1);
      return row ? mapEvaluation(row) : null;
    },

    async claimEvaluation(input) {
      const now = new Date();
      const [row] = await database
        .insert(matchingEvaluations)
        .values({
          ...input,
          status: "RUNNING",
          attemptCount: 1,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [
            matchingEvaluations.candidateUserId,
            matchingEvaluations.jobId,
          ],
          set: {
            inputHash: input.inputHash,
            scoringVersion: input.scoringVersion,
            status: "RUNNING",
            ruleScore: null,
            matchScore: null,
            confidence: null,
            recommendedAction: null,
            reasons: [],
            missingRequirements: [],
            riskFlags: [],
            failureCode: null,
            attemptCount: sql`${matchingEvaluations.attemptCount} + 1`,
            updatedAt: now,
          },
          setWhere: or(
            ne(matchingEvaluations.inputHash, input.inputHash),
            ne(matchingEvaluations.scoringVersion, input.scoringVersion),
            eq(matchingEvaluations.status, "PENDING"),
            and(
              eq(matchingEvaluations.status, "FAILED"),
              sql`${matchingEvaluations.failureCode} like 'RETRYABLE:%'`,
            ),
          ),
        })
        .returning();
      if (row) {
        return {
          status: "claimed",
          claim: {
            ...input,
            attemptCount: row.attemptCount,
          },
        };
      }

      const evaluation = await this.getEvaluation(input);
      if (!evaluation) {
        throw new Error("matching evaluation claim lost without a persisted row");
      }
      return evaluation.status === "RUNNING"
        ? { status: "busy", evaluation }
        : { status: "unchanged", evaluation };
    },

    async completeEvaluation(input) {
      const rows = await database
        .update(matchingEvaluations)
        .set({
          status: "COMPLETED",
          ruleScore: input.ruleScore,
          matchScore: input.matchScore,
          confidence: input.confidence,
          recommendedAction: input.recommendedAction,
          reasons: input.reasons,
          missingRequirements: input.missingRequirements,
          riskFlags: input.riskFlags,
          failureCode: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(matchingEvaluations.candidateUserId, input.candidateUserId),
            eq(matchingEvaluations.jobId, input.jobId),
            eq(matchingEvaluations.inputHash, input.inputHash),
            eq(matchingEvaluations.scoringVersion, input.scoringVersion),
            eq(matchingEvaluations.attemptCount, input.attemptCount),
            eq(matchingEvaluations.status, "RUNNING"),
          ),
        )
        .returning({ id: matchingEvaluations.id });
      return rows.length === 1;
    },

    async failEvaluation(input) {
      const rows = await database
        .update(matchingEvaluations)
        .set({
          status: "FAILED",
          failureCode: `${input.retryable ? "RETRYABLE" : "FINAL"}:${input.failureCode}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(matchingEvaluations.candidateUserId, input.candidateUserId),
            eq(matchingEvaluations.jobId, input.jobId),
            eq(matchingEvaluations.inputHash, input.inputHash),
            eq(matchingEvaluations.scoringVersion, input.scoringVersion),
            eq(matchingEvaluations.attemptCount, input.attemptCount),
            or(
              eq(matchingEvaluations.status, "RUNNING"),
              eq(matchingEvaluations.status, "COMPLETED"),
            ),
          ),
        )
        .returning({ id: matchingEvaluations.id });
      return rows.length === 1;
    },

    async recordAgentRun(input) {
      await database.insert(agentRuns).values({
        agentName: input.agentName,
        workflowName: input.workflowName,
        status: input.status,
        input: input.input ?? null,
        output: input.output ?? null,
        errorMessage: input.errorMessage ?? null,
        latencyMs: input.latencyMs ?? null,
      });
    },
  };
}

/**
 * In-memory repository for unit tests. Avoids any Postgres dependency while
 * exercising the full pipeline (filter → rule score → rerank → save).
 */
export function createInMemoryMatchingRepository(): MatchingRepository & {
  seedCandidate(candidate: CandidateMatchInput): void;
  seedJob(job: JobMatchInput): void;
  seedApplication(candidateUserId: string, jobId: string): void;
  seedEvaluation(
    evaluation: Pick<
      MatchingEvaluation,
      "candidateUserId" | "jobId" | "inputHash" | "status"
    > &
      Partial<MatchingEvaluation>,
  ): void;
  snapshotRecommendations(): RecommendationSnapshot[];
  snapshotEvaluations(): MatchingEvaluation[];
} {
  const candidates = new Map<string, CandidateMatchInput>();
  const jobStore = new Map<string, JobMatchInput>();
  const applied = new Map<string, Set<string>>();
  const savedRecommendations = new Map<string, RecommendationSnapshot>();
  const evaluations = new Map<string, MatchingEvaluation>();

  return {
    seedCandidate(candidate) {
      candidates.set(candidate.userId, candidate);
    },
    seedJob(job) {
      jobStore.set(job.id, job);
    },
    seedApplication(candidateUserId, jobId) {
      const set = applied.get(candidateUserId) ?? new Set<string>();
      set.add(jobId);
      applied.set(candidateUserId, set);
    },
    seedEvaluation(evaluation) {
      const now = new Date();
      const seeded: MatchingEvaluation = {
        id: crypto.randomUUID(),
        scoringVersion: MATCHING_SCORING_VERSION,
        ruleScore: null,
        matchScore: null,
        confidence: null,
        recommendedAction: null,
        reasons: [],
        missingRequirements: [],
        riskFlags: [],
        failureCode: null,
        attemptCount: 0,
        createdAt: now,
        updatedAt: now,
        ...evaluation,
      };
      evaluations.set(matchingPairKey(seeded), seeded);
    },
    async getCandidateProfile(userId) {
      const candidate = candidates.get(userId);
      if (!candidate || candidate.profileStatus !== "CONFIRMED") {
        return null;
      }
      return candidate;
    },
    async listConfirmedCandidates() {
      return [...candidates.values()].filter(
        (candidate) => candidate.profileStatus === "CONFIRMED",
      );
    },
    async listActiveJobs(options) {
      return [...jobStore.values()].filter(
        (job) =>
          job.status === "ACTIVE" &&
          job.recruiterUserId !== options?.excludeRecruiterUserId,
      );
    },
    async getActiveJob(jobId) {
      const found = jobStore.get(jobId);
      return found?.status === "ACTIVE" ? found : null;
    },
    async listAppliedJobIds(candidateUserId) {
      return new Set(applied.get(candidateUserId) ?? []);
    },
    async getRecommendation(candidateUserId, jobId, type) {
      const found = savedRecommendations.get(
        `${candidateUserId}:${jobId}:${type}`,
      );
      return found ? { id: found.id } : null;
    },
    async saveRecommendation(input) {
      const key = `${input.candidateUserId}:${input.jobId}:${input.type}`;
      const existing = savedRecommendations.get(key);
      const recommendation: RecommendationSnapshot = {
        id: existing?.id ?? crypto.randomUUID(),
        type: input.type,
        candidateUserId: input.candidateUserId,
        jobId: input.jobId,
        matchScore: input.matchScore,
        recommendedAction: input.recommendedAction,
        status: "NEW",
      };
      savedRecommendations.set(key, recommendation);
      return recommendation.id;
    },
    async deactivateRecommendations(pair) {
      let count = 0;
      for (const [key, recommendation] of savedRecommendations) {
        if (
          recommendation.candidateUserId === pair.candidateUserId &&
          recommendation.jobId === pair.jobId &&
          recommendation.status !== "EXPIRED"
        ) {
          savedRecommendations.set(key, {
            ...recommendation,
            status: "EXPIRED",
          });
          count += 1;
        }
      }
      return count;
    },
    async deactivateIneligiblePairs(activePairs) {
      let count = 0;
      for (const [key, recommendation] of savedRecommendations) {
        if (
          recommendation.status !== "EXPIRED" &&
          !activePairs.has(matchingPairKey(recommendation))
        ) {
          savedRecommendations.set(key, {
            ...recommendation,
            status: "EXPIRED",
          });
          count += 1;
        }
      }
      return count;
    },
    async getEvaluation(pair) {
      return evaluations.get(matchingPairKey(pair)) ?? null;
    },
    async claimEvaluation(input) {
      const key = matchingPairKey(input);
      const existing = evaluations.get(key);
      if (!existing) {
        const now = new Date();
        const evaluation: MatchingEvaluation = {
          id: crypto.randomUUID(),
          ...input,
          status: "RUNNING",
          ruleScore: null,
          matchScore: null,
          confidence: null,
          recommendedAction: null,
          reasons: [],
          missingRequirements: [],
          riskFlags: [],
          failureCode: null,
          attemptCount: 1,
          createdAt: now,
          updatedAt: now,
        };
        evaluations.set(key, evaluation);
        return {
          status: "claimed",
          claim: { ...input, attemptCount: 1 },
        };
      }

      const changed =
        existing.inputHash !== input.inputHash ||
        existing.scoringVersion !== input.scoringVersion;
      const retryable =
        existing.status === "FAILED" &&
        existing.failureCode?.startsWith("RETRYABLE:");
      if (changed || existing.status === "PENDING" || retryable) {
        const attemptCount = existing.attemptCount + 1;
        evaluations.set(key, {
          ...existing,
          ...input,
          status: "RUNNING",
          ruleScore: null,
          matchScore: null,
          confidence: null,
          recommendedAction: null,
          reasons: [],
          missingRequirements: [],
          riskFlags: [],
          failureCode: null,
          attemptCount,
          updatedAt: new Date(),
        });
        return {
          status: "claimed",
          claim: { ...input, attemptCount },
        };
      }
      return existing.status === "RUNNING"
        ? { status: "busy", evaluation: existing }
        : { status: "unchanged", evaluation: existing };
    },
    async completeEvaluation(input) {
      const key = matchingPairKey(input);
      const existing = evaluations.get(key);
      if (
        !existing ||
        existing.status !== "RUNNING" ||
        existing.inputHash !== input.inputHash ||
        existing.scoringVersion !== input.scoringVersion ||
        existing.attemptCount !== input.attemptCount
      ) {
        return false;
      }
      evaluations.set(key, {
        ...existing,
        status: "COMPLETED",
        ruleScore: input.ruleScore,
        matchScore: input.matchScore,
        confidence: input.confidence,
        recommendedAction: input.recommendedAction,
        reasons: [...input.reasons],
        missingRequirements: [...input.missingRequirements],
        riskFlags: [...input.riskFlags],
        failureCode: null,
        updatedAt: new Date(),
      });
      return true;
    },
    async failEvaluation(input) {
      const key = matchingPairKey(input);
      const existing = evaluations.get(key);
      if (
        !existing ||
        (existing.status !== "RUNNING" && existing.status !== "COMPLETED") ||
        existing.inputHash !== input.inputHash ||
        existing.scoringVersion !== input.scoringVersion ||
        existing.attemptCount !== input.attemptCount
      ) {
        return false;
      }
      evaluations.set(key, {
        ...existing,
        status: "FAILED",
        failureCode: `${input.retryable ? "RETRYABLE" : "FINAL"}:${input.failureCode}`,
        updatedAt: new Date(),
      });
      return true;
    },
    async recordAgentRun() {
      // No-op: in-memory tests do not assert agent_runs rows.
    },
    snapshotRecommendations() {
      return [...savedRecommendations.values()].map((recommendation) => ({
        ...recommendation,
      }));
    },
    snapshotEvaluations() {
      return [...evaluations.values()].map((evaluation) => ({
        ...evaluation,
        reasons: [...evaluation.reasons],
        missingRequirements: [...evaluation.missingRequirements],
        riskFlags: [...evaluation.riskFlags],
      }));
    },
  };
}
