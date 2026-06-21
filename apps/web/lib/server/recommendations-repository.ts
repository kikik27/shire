import { and, desc, eq, inArray } from "drizzle-orm";

import {
  createDatabase,
  type Database,
} from "./db";
<<<<<<< HEAD
import { candidateProfiles, jobs, recommendations } from "./db/schema";
=======
import { jobs, recommendations } from "./db/schema";
>>>>>>> bd09cea (feat(shared): matching contracts + recommendations data layer)
import type {
  RecommendationStatus,
  RecommendationType,
} from "@shire/shared";

<<<<<<< HEAD
export type RecommendationCandidateSummary = {
  displayName?: string;
  headline?: string;
  skills: string[];
  roleTargets: string[];
  location?: string;
};

export type RecommendationJobSummary = {
  title: string;
  companyName: string;
  location: string;
  remote: boolean;
  experienceLevel: string;
  skillsRequired: string[];
};

=======
>>>>>>> bd09cea (feat(shared): matching contracts + recommendations data layer)
export type PersistedRecommendation = {
  id: string;
  type: RecommendationType;
  candidateUserId: string;
  recruiterUserId?: string;
  jobId?: string;
  matchScore: number;
  confidence?: number;
  reasons: string[];
  missingRequirements: string[];
  riskFlags: string[];
  recommendedAction: string;
  status: RecommendationStatus;
  createdAt: number;
  updatedAt: number;
<<<<<<< HEAD
  candidate?: RecommendationCandidateSummary;
  job?: RecommendationJobSummary;
=======
>>>>>>> bd09cea (feat(shared): matching contracts + recommendations data layer)
};

export interface RecommendationsRepository {
  listRecommendationsForCandidate(candidateUserId: string): Promise<PersistedRecommendation[]>;
  listRecommendationsForRecruiter(recruiterUserId: string): Promise<PersistedRecommendation[]>;
}

export class RecommendationsRepositoryError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "RecommendationsRepositoryError";
  }
}

function numericValue(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return undefined;
  }
  return typeof value === "number" ? value : Number(value);
}

function toTimestamp(value: Date | number) {
  return value instanceof Date ? value.getTime() : value;
}

<<<<<<< HEAD
function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function mapCandidateSummary(
  row: typeof candidateProfiles.$inferSelect | null | undefined,
): RecommendationCandidateSummary | undefined {
  if (!row) return undefined;

  const profile = (row.profile ?? {}) as Record<string, unknown>;
  const roleTargets = asStringArray(profile.preferredRoles).length
    ? asStringArray(profile.preferredRoles)
    : asStringArray(profile.roleTargets);

  return {
    displayName: asString(profile.fullName) ?? asString(profile.displayName),
    headline: asString(profile.headline) ?? asString(profile.bio),
    skills: asStringArray(profile.skills),
    roleTargets,
    location: asString(profile.location),
  };
}

function mapJobSummary(
  row: typeof jobs.$inferSelect | null | undefined,
): RecommendationJobSummary | undefined {
  if (!row) return undefined;

  return {
    title: row.title,
    companyName: row.companyName,
    location: row.location,
    remote: row.remote,
    experienceLevel: row.experienceLevel,
    skillsRequired: row.skillsRequired,
  };
}

function mapRecommendation(
  row: typeof recommendations.$inferSelect,
  details: {
    candidate?: typeof candidateProfiles.$inferSelect | null;
    job?: typeof jobs.$inferSelect | null;
  } = {},
=======
function mapRecommendation(
  row: typeof recommendations.$inferSelect,
>>>>>>> bd09cea (feat(shared): matching contracts + recommendations data layer)
): PersistedRecommendation {
  return {
    id: row.id,
    type: row.type,
    candidateUserId: row.candidateUserId,
    recruiterUserId: row.recruiterUserId ?? undefined,
    jobId: row.jobId ?? undefined,
    matchScore: row.matchScore,
    confidence: numericValue(row.confidence),
    reasons: row.reasons,
    missingRequirements: row.missingRequirements,
    riskFlags: row.riskFlags,
    recommendedAction: row.recommendedAction,
    status: row.status,
    createdAt: toTimestamp(row.createdAt),
    updatedAt: toTimestamp(row.updatedAt),
<<<<<<< HEAD
    candidate: mapCandidateSummary(details.candidate),
    job: mapJobSummary(details.job),
=======
>>>>>>> bd09cea (feat(shared): matching contracts + recommendations data layer)
  };
}

export function createDrizzleRecommendationsRepository(
  database: Database = createDatabase(),
): RecommendationsRepository {
  return {
    async listRecommendationsForCandidate(candidateUserId) {
      try {
        const rows = await database
<<<<<<< HEAD
          .select({
            recommendation: recommendations,
            job: jobs,
          })
          .from(recommendations)
          .leftJoin(jobs, eq(recommendations.jobId, jobs.id))
=======
          .select()
          .from(recommendations)
>>>>>>> bd09cea (feat(shared): matching contracts + recommendations data layer)
          .where(
            and(
              eq(recommendations.candidateUserId, candidateUserId),
              eq(recommendations.type, "JOB_TO_CANDIDATE"),
            ),
          )
          .orderBy(desc(recommendations.matchScore), desc(recommendations.createdAt));
<<<<<<< HEAD
        return rows.map((row) =>
          mapRecommendation(row.recommendation, { job: row.job }),
        );
=======
        return rows.map(mapRecommendation);
>>>>>>> bd09cea (feat(shared): matching contracts + recommendations data layer)
      } catch (error) {
        throw new RecommendationsRepositoryError(
          "Failed to list candidate recommendations.",
          { cause: error },
        );
      }
    },
    async listRecommendationsForRecruiter(recruiterUserId) {
      try {
        // Talent recommendations are scoped to the recruiter's own jobs.
        const recruiterJobs = await database
          .select({ id: jobs.id })
          .from(jobs)
          .where(eq(jobs.recruiterUserId, recruiterUserId));

        if (recruiterJobs.length === 0) {
          return [];
        }

        const rows = await database
<<<<<<< HEAD
          .select({
            recommendation: recommendations,
            candidate: candidateProfiles,
            job: jobs,
          })
          .from(recommendations)
          .leftJoin(
            candidateProfiles,
            eq(recommendations.candidateUserId, candidateProfiles.userId),
          )
          .leftJoin(jobs, eq(recommendations.jobId, jobs.id))
=======
          .select()
          .from(recommendations)
>>>>>>> bd09cea (feat(shared): matching contracts + recommendations data layer)
          .where(
            and(
              inArray(
                recommendations.jobId,
                recruiterJobs.map((job) => job.id),
              ),
              eq(recommendations.type, "TALENT_TO_COMPANY"),
            ),
          )
          .orderBy(desc(recommendations.matchScore), desc(recommendations.createdAt));
<<<<<<< HEAD
        return rows.map((row) =>
          mapRecommendation(row.recommendation, {
            candidate: row.candidate,
            job: row.job,
          }),
        );
=======
        return rows.map(mapRecommendation);
>>>>>>> bd09cea (feat(shared): matching contracts + recommendations data layer)
      } catch (error) {
        throw new RecommendationsRepositoryError(
          "Failed to list recruiter recommendations.",
          { cause: error },
        );
      }
    },
  };
}

export function createInMemoryRecommendationsRepository(): RecommendationsRepository & {
  seed(recommendation: PersistedRecommendation): void;
} {
  const stored = new Map<string, PersistedRecommendation>();

  function sorted(rows: PersistedRecommendation[]) {
    return rows.sort(
      (a, b) => b.matchScore - a.matchScore || b.createdAt - a.createdAt,
    );
  }

  return {
    seed(recommendation) {
      stored.set(recommendation.id, recommendation);
    },
    async listRecommendationsForCandidate(candidateUserId) {
      return sorted(
        [...stored.values()].filter(
          (recommendation) =>
            recommendation.candidateUserId === candidateUserId &&
            recommendation.type === "JOB_TO_CANDIDATE",
        ),
      );
    },
    async listRecommendationsForRecruiter(recruiterUserId) {
      return sorted(
        [...stored.values()].filter(
          (recommendation) =>
            recommendation.recruiterUserId === recruiterUserId &&
            recommendation.type === "TALENT_TO_COMPANY",
        ),
      );
    },
  };
}
