import {
  and,
  eq,
  gt,
  inArray,
  isNull,
  lt,
  ne,
  or,
  sql,
} from "drizzle-orm";
import {
  MATCHING_SCORING_VERSION,
  type MatchingEvaluationStatus,
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
  type MatchingEvaluationClaim,
  type MatchingEvaluationClaimInput,
  type MatchingPair,
  type MatchingReconciliationCursor,
  type MatchingRepository,
  matchingPairKey,
  type MatchingRecommendationPublication,
  type RecommendationInput,
  type RecommendationSnapshot,
} from "./types";
import {
  createMatchingFingerprint,
  matchingQueueGeneration,
  RUNNING_EVALUATION_LEASE_MS,
  shouldReconcileMatchingPair,
} from "./fingerprint";

export { RUNNING_EVALUATION_LEASE_MS } from "./fingerprint";

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
    recommendedAction: parsePersistedRecommendedAction(row.recommendedAction),
    reasons: row.reasons ?? [],
    missingRequirements: row.missingRequirements ?? [],
    riskFlags: row.riskFlags ?? [],
  };
}

export function parsePersistedRecommendedAction(
  value: string | null,
): MatchingOutput["recommendedAction"] | null {
  if (value === null) {
    return null;
  }
  if (
    value === "SUGGEST_APPLY" ||
    value === "SUGGEST_INVITE" ||
    value === "SAVE_ONLY" ||
    value === "IGNORE"
  ) {
    return value;
  }
  throw new Error(`invalid persisted recommendedAction: ${value}`);
}

export function classifyEvaluationClaimConflict(
  input: MatchingEvaluationClaimInput,
  evaluation: MatchingEvaluation,
): "busy" | "unchanged" {
  return evaluation.inputHash === input.inputHash &&
    evaluation.scoringVersion === input.scoringVersion &&
    evaluation.status === "COMPLETED"
    ? "unchanged"
    : "busy";
}

function evaluationFence(
  input: MatchingEvaluationClaim,
  status: MatchingEvaluationStatus,
) {
  return and(
    eq(matchingEvaluations.candidateUserId, input.candidateUserId),
    eq(matchingEvaluations.jobId, input.jobId),
    eq(matchingEvaluations.inputHash, input.inputHash),
    eq(matchingEvaluations.scoringVersion, input.scoringVersion),
    eq(matchingEvaluations.attemptCount, input.attemptCount),
    eq(matchingEvaluations.status, status),
  );
}

type AgentTransaction = Parameters<
  Parameters<AgentDatabase["transaction"]>[0]
>[0];
type AgentQueryExecutor = Pick<AgentTransaction, "insert" | "select">;

function findSqlState(error: unknown): string | undefined {
  let current = error;
  for (let depth = 0; depth < 5 && current && typeof current === "object"; depth += 1) {
    const record = current as { code?: unknown; cause?: unknown };
    if (typeof record.code === "string") {
      return record.code;
    }
    current = record.cause;
  }
  return undefined;
}

export async function retryPostgresSerialization<T>(
  operation: () => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= maxAttempts || findSqlState(error) !== "40001") {
        throw error;
      }
    }
  }
}

async function getDrizzleEvaluation(
  executor: AgentQueryExecutor,
  pair: MatchingPair,
): Promise<MatchingEvaluation | null> {
  const [row] = await executor
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
}

async function claimDrizzleEvaluation(
  executor: AgentQueryExecutor,
  input: MatchingEvaluationClaimInput,
  now: Date,
) {
  const leaseCutoff = new Date(now.getTime() - RUNNING_EVALUATION_LEASE_MS);
  const [row] = await executor
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
        and(
          eq(matchingEvaluations.status, "RUNNING"),
          lt(matchingEvaluations.updatedAt, leaseCutoff),
        ),
      ),
    })
    .returning();
  if (row) {
    return {
      status: "claimed" as const,
      claim: {
        ...input,
        attemptCount: row.attemptCount,
      },
    };
  }

  const evaluation = await getDrizzleEvaluation(executor, input);
  if (!evaluation) {
    throw new Error("matching evaluation claim lost without a persisted row");
  }
  return {
    status: classifyEvaluationClaimConflict(input, evaluation),
    evaluation,
  };
}

async function writeDrizzleRecommendations(
  transaction: AgentTransaction,
  input: MatchingEvaluationClaim,
  publications: MatchingRecommendationPublication,
  now: Date,
): Promise<number> {
  if (publications === null) {
    const expired = await transaction
      .update(recommendations)
      .set({ status: "EXPIRED", updatedAt: now })
      .where(
        and(
          eq(recommendations.candidateUserId, input.candidateUserId),
          eq(recommendations.jobId, input.jobId),
          ne(recommendations.status, "EXPIRED"),
        ),
      )
      .returning({ id: recommendations.id });
    return expired.length;
  }

  let written = 0;
  for (const publication of publications) {
    const values = {
      ...publication,
      confidence: String(publication.confidence),
      status: "NEW" as const,
      updatedAt: now,
    };
    const rows = await transaction
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
          updatedAt: now,
        },
      })
      .returning({ id: recommendations.id });
    written += rows.length;
  }
  return written;
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

    async reconcileMatchingPairs(options) {
      const cursorCondition = options.cursor
        ? or(
            gt(candidateProfiles.userId, options.cursor.candidateId),
            and(
              eq(candidateProfiles.userId, options.cursor.candidateId),
              gt(jobs.id, options.cursor.jobId),
            ),
          )
        : undefined;
      const rows = await database
        .select({
          candidate: candidateProfiles,
          job: jobs,
          applicationId: applications.id,
          evaluation: matchingEvaluations,
        })
        .from(candidateProfiles)
        .innerJoin(
          jobs,
          and(
            eq(jobs.status, "ACTIVE"),
            ne(jobs.recruiterUserId, candidateProfiles.userId),
          ),
        )
        .leftJoin(
          applications,
          and(
            eq(applications.candidateUserId, candidateProfiles.userId),
            eq(applications.jobId, jobs.id),
          ),
        )
        .leftJoin(
          matchingEvaluations,
          and(
            eq(
              matchingEvaluations.candidateUserId,
              candidateProfiles.userId,
            ),
            eq(matchingEvaluations.jobId, jobs.id),
          ),
        )
        .where(
          and(
            eq(candidateProfiles.profileStatus, "CONFIRMED"),
            cursorCondition,
          ),
        )
        .orderBy(candidateProfiles.userId, jobs.id)
        .limit(options.limit);
      const now = options.now ?? new Date();
      const pairs = rows.flatMap((row) => {
        const candidate = mapCandidateProfileForMatching(row.candidate);
        const job = mapJob(row.job);
        const inputHash = createMatchingFingerprint(candidate, job, {
          hasApplied: row.applicationId !== null,
        });
        const evaluation = row.evaluation
          ? mapEvaluation(row.evaluation)
          : null;
        return shouldReconcileMatchingPair(inputHash, evaluation, now)
          ? [{
              candidateId: candidate.userId,
              jobId: job.id,
              inputHash,
              queueGeneration: matchingQueueGeneration(inputHash, evaluation),
            }]
          : [];
      });
      const last = rows.at(-1);
      return {
        pairs,
        scannedPairs: rows.length,
        skippedPairs: rows.length - pairs.length,
        nextCursor:
          rows.length === options.limit && last
            ? {
                candidateId: last.candidate.userId,
                jobId: last.job.id,
              }
            : undefined,
      };
    },

    async expireUnavailableRecommendations(options) {
      return database.transaction(async (transaction) => {
        const stale = await transaction
          .select({ id: recommendations.id })
          .from(recommendations)
          .leftJoin(
            candidateProfiles,
            eq(candidateProfiles.userId, recommendations.candidateUserId),
          )
          .leftJoin(jobs, eq(jobs.id, recommendations.jobId))
          .where(
            and(
              ne(recommendations.status, "EXPIRED"),
              lt(recommendations.updatedAt, options.updatedBefore),
              or(
                isNull(candidateProfiles.userId),
                ne(candidateProfiles.profileStatus, "CONFIRMED"),
                isNull(jobs.id),
                ne(jobs.status, "ACTIVE"),
                eq(jobs.recruiterUserId, recommendations.candidateUserId),
              ),
            ),
          )
          .orderBy(recommendations.updatedAt, recommendations.id)
          .limit(options.limit);
        if (stale.length === 0) {
          return 0;
        }
        const expired = await transaction
          .update(recommendations)
          .set({ status: "EXPIRED", updatedAt: new Date() })
          .where(
            and(
              inArray(
                recommendations.id,
                stale.map((row) => row.id),
              ),
              ne(recommendations.status, "EXPIRED"),
              lt(recommendations.updatedAt, options.updatedBefore),
            ),
          )
          .returning({ id: recommendations.id });
        return expired.length;
      });
    },

    async prepareEvaluation(pair, options) {
      return retryPostgresSerialization(() =>
        database.transaction(
          async (transaction) => {
            const [candidateRow, jobRow, applicationRows] = await Promise.all([
              transaction
                .select()
                .from(candidateProfiles)
                .where(eq(candidateProfiles.userId, pair.candidateUserId))
                .limit(1),
              transaction
                .select()
                .from(jobs)
                .where(eq(jobs.id, pair.jobId))
                .limit(1),
              transaction
                .select({ jobId: applications.jobId })
                .from(applications)
                .where(eq(applications.candidateUserId, pair.candidateUserId)),
            ]);
            const candidateSource = candidateRow[0];
            const jobSource = jobRow[0];
            if (
              !candidateSource ||
              candidateSource.profileStatus !== "CONFIRMED" ||
              !jobSource ||
              jobSource.status !== "ACTIVE"
            ) {
              return { status: "unavailable" as const };
            }

            const candidate = mapCandidateProfileForMatching(candidateSource);
            const job = mapJob(jobSource);
            const appliedJobIds = new Set(
              applicationRows.map((application) => application.jobId),
            );
            const claimResult = await claimDrizzleEvaluation(
              transaction,
              {
                ...pair,
                inputHash: createMatchingFingerprint(candidate, job, {
                  hasApplied: appliedJobIds.has(job.id),
                }),
                scoringVersion: MATCHING_SCORING_VERSION,
              },
              options?.now ?? new Date(),
            );
            return {
              status: "ready" as const,
              candidate,
              job,
              appliedJobIds,
              claimResult,
            };
          },
          {
            isolationLevel: "serializable",
            accessMode: "read write",
          },
        ),
      );
    },

    async getEvaluation(pair) {
      return getDrizzleEvaluation(database, pair);
    },

    async claimEvaluation(input, options) {
      const now = options?.now ?? new Date();
      return claimDrizzleEvaluation(database, input, now);
    },

    async publishEvaluation(input) {
      return database.transaction(async (transaction) => {
        const now = new Date();
        const rows = await transaction
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
            updatedAt: now,
          })
          .where(evaluationFence(input, "RUNNING"))
          .returning({ id: matchingEvaluations.id });
        if (rows.length !== 1) {
          return { published: false, recommendationRowsWritten: 0 };
        }
        return {
          published: true,
          recommendationRowsWritten: await writeDrizzleRecommendations(
            transaction,
            input,
            input.recommendations,
            now,
          ),
        };
      });
    },

    async repairRecommendations(input) {
      return database.transaction(async (transaction) => {
        const rows = await transaction
          .update(matchingEvaluations)
          .set({ updatedAt: sql`${matchingEvaluations.updatedAt}` })
          .where(evaluationFence(input, "COMPLETED"))
          .returning({ id: matchingEvaluations.id });
        if (rows.length !== 1) {
          return { published: false, recommendationRowsWritten: 0 };
        }
        return {
          published: true,
          recommendationRowsWritten: await writeDrizzleRecommendations(
            transaction,
            input,
            input.recommendations,
            new Date(),
          ),
        };
      });
    },

    async failEvaluation(input) {
      const rows = await database
        .update(matchingEvaluations)
        .set({
          status: "FAILED",
          failureCode: `${input.retryable ? "RETRYABLE" : "FINAL"}:${input.failureCode}`,
          updatedAt: new Date(),
        })
        .where(evaluationFence(input, "RUNNING"))
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
export function createInMemoryMatchingRepository(
  options: {
    beforeRecommendationWrite?: (input: RecommendationInput) => void;
  } = {},
): MatchingRepository & {
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

  function stageRecommendations(
    input: MatchingEvaluationClaim,
    publications: MatchingRecommendationPublication,
  ) {
    const staged = new Map(savedRecommendations);
    let written = 0;
    if (publications === null) {
      for (const [key, recommendation] of staged) {
        if (
          recommendation.candidateUserId === input.candidateUserId &&
          recommendation.jobId === input.jobId &&
          recommendation.status !== "EXPIRED"
        ) {
          staged.set(key, { ...recommendation, status: "EXPIRED" });
          written += 1;
        }
      }
      return { staged, written };
    }

    for (const publication of publications) {
      options.beforeRecommendationWrite?.(publication);
      const key = `${publication.candidateUserId}:${publication.jobId}:${publication.type}`;
      const existing = staged.get(key);
      staged.set(key, {
        id: existing?.id ?? crypto.randomUUID(),
        type: publication.type,
        candidateUserId: publication.candidateUserId,
        jobId: publication.jobId,
        matchScore: publication.matchScore,
        recommendedAction: publication.recommendedAction,
        status: "NEW",
      });
      written += 1;
    }
    return { staged, written };
  }

  function commitRecommendations(
    staged: Map<string, RecommendationSnapshot>,
  ) {
    savedRecommendations.clear();
    for (const [key, recommendation] of staged) {
      savedRecommendations.set(key, recommendation);
    }
  }

  function claimInMemoryEvaluation(
    input: MatchingEvaluationClaimInput,
    now: Date,
  ) {
    const key = matchingPairKey(input);
    const existing = evaluations.get(key);
    if (!existing) {
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
        status: "claimed" as const,
        claim: { ...input, attemptCount: 1 },
      };
    }

    const changed =
      existing.inputHash !== input.inputHash ||
      existing.scoringVersion !== input.scoringVersion;
    const retryable =
      existing.status === "FAILED" &&
      existing.failureCode?.startsWith("RETRYABLE:");
    const leaseExpired =
      existing.status === "RUNNING" &&
      existing.updatedAt.getTime() <
        now.getTime() - RUNNING_EVALUATION_LEASE_MS;
    if (changed || existing.status === "PENDING" || retryable || leaseExpired) {
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
        updatedAt: now,
      });
      return {
        status: "claimed" as const,
        claim: { ...input, attemptCount },
      };
    }
    return {
      status: classifyEvaluationClaimConflict(input, existing),
      evaluation: existing,
    };
  }

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
    async reconcileMatchingPairs({ limit, cursor, now = new Date() }) {
      const allPairs = [...candidates.values()]
        .filter((candidate) => candidate.profileStatus === "CONFIRMED")
        .flatMap((candidate) =>
          [...jobStore.values()]
            .filter(
              (job) =>
                job.status === "ACTIVE" &&
                job.recruiterUserId !== candidate.userId,
            )
            .map((job) => ({ candidate, job })),
        )
        .sort(
          (left, right) =>
            left.candidate.userId.localeCompare(right.candidate.userId) ||
            left.job.id.localeCompare(right.job.id),
        )
        .filter(
          ({ candidate, job }) =>
            !cursor ||
            candidate.userId > cursor.candidateId ||
            (candidate.userId === cursor.candidateId &&
              job.id > cursor.jobId),
        )
        .slice(0, limit);
      const pairs = allPairs.flatMap(({ candidate, job }) => {
        const inputHash = createMatchingFingerprint(candidate, job, {
          hasApplied: applied.get(candidate.userId)?.has(job.id) ?? false,
        });
        const evaluation =
          evaluations.get(
            matchingPairKey({
              candidateUserId: candidate.userId,
              jobId: job.id,
            }),
          ) ?? null;
        return shouldReconcileMatchingPair(
          inputHash,
          evaluation,
          now,
        )
          ? [{
              candidateId: candidate.userId,
              jobId: job.id,
              inputHash,
              queueGeneration: matchingQueueGeneration(inputHash, evaluation),
            }]
          : [];
      });
      const last = allPairs.at(-1);
      return {
        pairs,
        scannedPairs: allPairs.length,
        skippedPairs: allPairs.length - pairs.length,
        nextCursor:
          allPairs.length === limit && last
            ? {
                candidateId: last.candidate.userId,
                jobId: last.job.id,
              }
            : undefined,
      };
    },
    async expireUnavailableRecommendations({ limit }) {
      let expired = 0;
      for (const [key, recommendation] of savedRecommendations) {
        if (expired >= limit) {
          break;
        }
        const candidate = candidates.get(recommendation.candidateUserId);
        const job = recommendation.jobId
          ? jobStore.get(recommendation.jobId)
          : undefined;
        if (
          recommendation.status !== "EXPIRED" &&
          (!candidate ||
            candidate.profileStatus !== "CONFIRMED" ||
            !job ||
            job.status !== "ACTIVE" ||
            job.recruiterUserId === recommendation.candidateUserId)
        ) {
          savedRecommendations.set(key, {
            ...recommendation,
            status: "EXPIRED",
          });
          expired += 1;
        }
      }
      return expired;
    },
    async prepareEvaluation(pair, claimOptions) {
      const candidate = candidates.get(pair.candidateUserId);
      const job = jobStore.get(pair.jobId);
      if (
        !candidate ||
        candidate.profileStatus !== "CONFIRMED" ||
        !job ||
        job.status !== "ACTIVE"
      ) {
        return { status: "unavailable" };
      }
      const appliedJobIds = new Set(applied.get(candidate.userId) ?? []);
      const claimResult = claimInMemoryEvaluation(
        {
          ...pair,
          inputHash: createMatchingFingerprint(candidate, job, {
            hasApplied: appliedJobIds.has(job.id),
          }),
          scoringVersion: MATCHING_SCORING_VERSION,
        },
        claimOptions?.now ?? new Date(),
      );
      return {
        status: "ready",
        candidate,
        job,
        appliedJobIds,
        claimResult,
      };
    },
    async getEvaluation(pair) {
      return evaluations.get(matchingPairKey(pair)) ?? null;
    },
    async claimEvaluation(input, claimOptions) {
      return claimInMemoryEvaluation(
        input,
        claimOptions?.now ?? new Date(),
      );
    },
    async publishEvaluation(input) {
      const key = matchingPairKey(input);
      const existing = evaluations.get(key);
      if (
        !existing ||
        existing.status !== "RUNNING" ||
        existing.inputHash !== input.inputHash ||
        existing.scoringVersion !== input.scoringVersion ||
        existing.attemptCount !== input.attemptCount
      ) {
        return { published: false, recommendationRowsWritten: 0 };
      }
      const { staged, written } = stageRecommendations(
        input,
        input.recommendations,
      );
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
      commitRecommendations(staged);
      return { published: true, recommendationRowsWritten: written };
    },
    async repairRecommendations(input) {
      const existing = evaluations.get(matchingPairKey(input));
      if (
        !existing ||
        existing.status !== "COMPLETED" ||
        existing.inputHash !== input.inputHash ||
        existing.scoringVersion !== input.scoringVersion ||
        existing.attemptCount !== input.attemptCount
      ) {
        return { published: false, recommendationRowsWritten: 0 };
      }
      const { staged, written } = stageRecommendations(
        input,
        input.recommendations,
      );
      commitRecommendations(staged);
      return { published: true, recommendationRowsWritten: written };
    },
    async failEvaluation(input) {
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
