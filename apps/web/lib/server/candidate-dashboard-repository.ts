import { and, count, desc, eq, ne, notInArray } from "drizzle-orm";

import type { ApplicationStatus } from "../types";
import { createDatabase, type Database } from "./db";
import { applications, jobs, recommendations } from "./db/schema";
import type { PersistedRecommendation } from "./recommendations-repository";

export type ApplicationSummary = {
  id: string;
  jobId: string;
  candidateUserId: string;
  status: ApplicationStatus;
  message: string;
  matchScore: number;
  riskScore: number;
  stakeTx?: string;
  stakeAmount?: number;
  createdAt: number;
  updatedAt: number;
  job: {
    title: string;
    companyName: string;
  };
};

export type CandidateDashboard = {
  activeApplicationCount: number;
  availableJobCount: number;
  newRecommendationCount: number;
  applications: ApplicationSummary[];
  recommendations: PersistedRecommendation[];
};

export interface CandidateDashboardRepository {
  getCandidateDashboard(candidateUserId: string): Promise<CandidateDashboard>;
}

export class CandidateDashboardRepositoryError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "CandidateDashboardRepositoryError";
  }
}

const terminalApplicationStatuses: ApplicationStatus[] = [
  "HIRED",
  "REJECTED",
  "WITHDRAWN",
];

function numericValue(value: string | number | null | undefined) {
  if (value === null || value === undefined) return undefined;
  return typeof value === "number" ? value : Number(value);
}

function toTimestamp(value: Date | number) {
  return value instanceof Date ? value.getTime() : value;
}

export function createDrizzleCandidateDashboardRepository(
  database: Database = createDatabase(),
): CandidateDashboardRepository {
  return {
    async getCandidateDashboard(candidateUserId) {
      try {
        const activeApplications = and(
          eq(applications.candidateUserId, candidateUserId),
          notInArray(applications.status, terminalApplicationStatuses),
        );
        const availableJobs = and(
          eq(jobs.status, "ACTIVE"),
          ne(jobs.recruiterUserId, candidateUserId),
        );
        const candidateRecommendations = and(
          eq(recommendations.candidateUserId, candidateUserId),
          eq(recommendations.type, "JOB_TO_CANDIDATE"),
          ne(recommendations.status, "EXPIRED"),
        );

        const [
          [activeApplicationCount],
          [availableJobCount],
          [newRecommendationCount],
          applicationRows,
          recommendationRows,
        ] = await Promise.all([
          database
            .select({ value: count() })
            .from(applications)
            .where(activeApplications),
          database.select({ value: count() }).from(jobs).where(availableJobs),
          database
            .select({ value: count() })
            .from(recommendations)
            .where(
              and(
                candidateRecommendations,
                eq(recommendations.status, "NEW"),
              ),
            ),
          database
            .select({ application: applications, job: jobs })
            .from(applications)
            .innerJoin(jobs, eq(applications.jobId, jobs.id))
            .where(activeApplications)
            .orderBy(desc(applications.createdAt))
            .limit(4),
          database
            .select({ recommendation: recommendations, job: jobs })
            .from(recommendations)
            .leftJoin(jobs, eq(recommendations.jobId, jobs.id))
            .where(candidateRecommendations)
            .orderBy(
              desc(recommendations.matchScore),
              desc(recommendations.createdAt),
            )
            .limit(3),
        ]);

        return {
          activeApplicationCount: activeApplicationCount?.value ?? 0,
          availableJobCount: availableJobCount?.value ?? 0,
          newRecommendationCount: newRecommendationCount?.value ?? 0,
          applications: applicationRows.map(({ application, job }) => ({
            id: application.id,
            jobId: application.jobId,
            candidateUserId: application.candidateUserId,
            status: application.status,
            message: application.message,
            matchScore: application.matchScore,
            riskScore: application.riskScore,
            stakeTx: application.stakeTx ?? undefined,
            stakeAmount: numericValue(application.stakeAmount),
            createdAt: toTimestamp(application.createdAt),
            updatedAt: toTimestamp(application.updatedAt),
            job: {
              title: job.title,
              companyName: job.companyName,
            },
          })),
          recommendations: recommendationRows.map(({ recommendation, job }) => ({
            id: recommendation.id,
            type: recommendation.type,
            candidateUserId: recommendation.candidateUserId,
            recruiterUserId: recommendation.recruiterUserId ?? undefined,
            jobId: recommendation.jobId ?? undefined,
            matchScore: recommendation.matchScore,
            confidence: numericValue(recommendation.confidence),
            reasons: recommendation.reasons,
            missingRequirements: recommendation.missingRequirements,
            riskFlags: recommendation.riskFlags,
            recommendedAction: recommendation.recommendedAction,
            status: recommendation.status,
            createdAt: toTimestamp(recommendation.createdAt),
            updatedAt: toTimestamp(recommendation.updatedAt),
            job: job
              ? {
                  title: job.title,
                  companyName: job.companyName,
                  location: job.location,
                  remote: job.remote,
                  experienceLevel: job.experienceLevel,
                  skillsRequired: job.skillsRequired,
                }
              : undefined,
          })),
        };
      } catch (error) {
        throw new CandidateDashboardRepositoryError(
          "Failed to load candidate dashboard.",
          { cause: error },
        );
      }
    },
  };
}
