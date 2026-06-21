import { and, desc, eq, inArray } from "drizzle-orm";

import {
  createDatabase,
  type Database,
} from "./db";
import { jobs, recommendations } from "./db/schema";
import type {
  RecommendationStatus,
  RecommendationType,
} from "@shire/shared";

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

function mapRecommendation(
  row: typeof recommendations.$inferSelect,
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
  };
}

export function createDrizzleRecommendationsRepository(
  database: Database = createDatabase(),
): RecommendationsRepository {
  return {
    async listRecommendationsForCandidate(candidateUserId) {
      try {
        const rows = await database
          .select()
          .from(recommendations)
          .where(
            and(
              eq(recommendations.candidateUserId, candidateUserId),
              eq(recommendations.type, "JOB_TO_CANDIDATE"),
            ),
          )
          .orderBy(desc(recommendations.matchScore), desc(recommendations.createdAt));
        return rows.map(mapRecommendation);
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
          .select()
          .from(recommendations)
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
        return rows.map(mapRecommendation);
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
