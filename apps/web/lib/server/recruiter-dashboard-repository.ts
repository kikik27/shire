import { and, count, desc, eq, gte, isNotNull, sql } from "drizzle-orm";

import type {
  ApplicationStatus,
  CandidateApplicationSummary,
  ExperienceLevel,
  JobStatus,
  TokenSymbol,
} from "../types";
import { createDatabase, type Database } from "./db";
import {
  applications,
  candidateProfiles,
  jobs,
  matchingEvaluations,
} from "./db/schema";
import {
  candidateApplicationSummary,
} from "./applications-repository";

export type RecruiterDashboardKpis = {
  activeJobs: number;
  applicants: number;
  interviews: number;
  offers: number;
};

export type RecruiterJobSummary = {
  id: string;
  recruiterUserId: string;
  title: string;
  companyName: string;
  experienceLevel: ExperienceLevel;
  status: JobStatus;
  stakeAmount: number;
  stakeToken: TokenSymbol;
  createdAt: number;
  applicantCount: number;
};

export type RecruiterApplicantSummary = {
  id: string;
  jobId: string;
  jobTitle: string;
  candidateUserId: string;
  status: ApplicationStatus;
  matchScore: number;
  createdAt: number;
  candidate?: CandidateApplicationSummary;
};

export type RecruiterDashboard = {
  kpis: RecruiterDashboardKpis;
  catalog: RecruiterJobSummary[];
  activity: Array<{ date: string; applications: number }>;
  matchDistribution: Array<{ bucket: string; count: number }>;
  pipeline: Array<{ status: ApplicationStatus; count: number }>;
  recentApplicants: RecruiterApplicantSummary[];
  talentRegions: Array<{ region: string; count: number }>;
};

export interface RecruiterDashboardRepository {
  getRecruiterDashboard(recruiterUserId: string): Promise<RecruiterDashboard>;
}

export class RecruiterDashboardRepositoryError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "RecruiterDashboardRepositoryError";
  }
}

const CATALOG_LIMIT = 5;
const RECENT_APPLICANT_LIMIT = 8;
const ACTIVITY_WINDOW_DAYS = 30;
const TALENT_REGION_LIMIT = 6;

function numericValue(value: string | number | null | undefined) {
  if (value === null || value === undefined) return 0;
  return typeof value === "number" ? value : Number(value);
}

function timestamp(value: Date | number) {
  return value instanceof Date ? value.getTime() : value;
}

export function createDrizzleRecruiterDashboardRepository(
  database: Database = createDatabase(),
): RecruiterDashboardRepository {
  return {
    async getRecruiterDashboard(recruiterUserId) {
      try {
        const activitySince = new Date(
          Date.now() - ACTIVITY_WINDOW_DAYS * 86_400_000,
        );
        const activityDate = sql<string>`to_char(${applications.createdAt}, 'YYYY-MM-DD')`;
        const matchBucket = sql<string>`case
          when ${matchingEvaluations.matchScore} >= 80 then 'strong'
          when ${matchingEvaluations.matchScore} >= 60 then 'partial'
          else 'review'
        end`;
        const candidateRegion = sql<string>`coalesce(nullif(${candidateProfiles.profile}->>'location', ''), 'Unknown')`;

        const [
          [kpiRow],
          catalogRows,
          activityRows,
          matchRows,
          pipelineRows,
          applicantRows,
          regionRows,
        ] = await Promise.all([
          database
            .select({
              activeJobs:
                sql<number>`count(distinct ${jobs.id}) filter (where ${jobs.status} = 'ACTIVE')`.mapWith(Number),
              applicants: sql<number>`count(${applications.id})`.mapWith(Number),
              interviews:
                sql<number>`count(${applications.id}) filter (where ${applications.status} = 'INTERVIEW')`.mapWith(Number),
              offers:
                sql<number>`count(${applications.id}) filter (where ${applications.status} = 'OFFERED')`.mapWith(Number),
            })
            .from(jobs)
            .leftJoin(applications, eq(applications.jobId, jobs.id))
            .where(eq(jobs.recruiterUserId, recruiterUserId)),
          database
            .select({
              id: jobs.id,
              recruiterUserId: jobs.recruiterUserId,
              title: jobs.title,
              companyName: jobs.companyName,
              experienceLevel: jobs.experienceLevel,
              status: jobs.status,
              stakeAmount: jobs.stakeAmount,
              stakeToken: jobs.stakeToken,
              createdAt: jobs.createdAt,
              applicantCount: count(applications.id),
            })
            .from(jobs)
            .leftJoin(applications, eq(applications.jobId, jobs.id))
            .where(eq(jobs.recruiterUserId, recruiterUserId))
            .groupBy(jobs.id)
            .orderBy(desc(jobs.createdAt))
            .limit(CATALOG_LIMIT),
          database
            .select({
              date: activityDate,
              applications: count(applications.id),
            })
            .from(applications)
            .innerJoin(jobs, eq(applications.jobId, jobs.id))
            .where(
              and(
                eq(jobs.recruiterUserId, recruiterUserId),
                gte(applications.createdAt, activitySince),
              ),
            )
            .groupBy(activityDate)
            .orderBy(activityDate),
          database
            .select({
              bucket: matchBucket,
              count: count(matchingEvaluations.id),
            })
            .from(matchingEvaluations)
            .innerJoin(jobs, eq(matchingEvaluations.jobId, jobs.id))
            .where(
              and(
                eq(jobs.recruiterUserId, recruiterUserId),
                eq(matchingEvaluations.status, "COMPLETED"),
                isNotNull(matchingEvaluations.matchScore),
              ),
            )
            .groupBy(matchBucket),
          database
            .select({
              status: applications.status,
              count: count(applications.id),
            })
            .from(applications)
            .innerJoin(jobs, eq(applications.jobId, jobs.id))
            .where(eq(jobs.recruiterUserId, recruiterUserId))
            .groupBy(applications.status),
          database
            .select({
              application: applications,
              jobTitle: jobs.title,
              profile: candidateProfiles.profile,
              evaluationMatchScore: matchingEvaluations.matchScore,
            })
            .from(applications)
            .innerJoin(jobs, eq(applications.jobId, jobs.id))
            .leftJoin(
              candidateProfiles,
              eq(applications.candidateUserId, candidateProfiles.userId),
            )
            .leftJoin(
              matchingEvaluations,
              and(
                eq(matchingEvaluations.jobId, applications.jobId),
                eq(
                  matchingEvaluations.candidateUserId,
                  applications.candidateUserId,
                ),
              ),
            )
            .where(eq(jobs.recruiterUserId, recruiterUserId))
            .orderBy(desc(applications.createdAt))
            .limit(RECENT_APPLICANT_LIMIT),
          database
            .select({
              region: candidateRegion,
              count:
                sql<number>`count(distinct ${applications.candidateUserId})`.mapWith(Number),
            })
            .from(applications)
            .innerJoin(jobs, eq(applications.jobId, jobs.id))
            .leftJoin(
              candidateProfiles,
              eq(applications.candidateUserId, candidateProfiles.userId),
            )
            .where(eq(jobs.recruiterUserId, recruiterUserId))
            .groupBy(candidateRegion)
            .orderBy(desc(sql`count(distinct ${applications.candidateUserId})`))
            .limit(TALENT_REGION_LIMIT),
        ]);

        return {
          kpis: {
            activeJobs: kpiRow?.activeJobs ?? 0,
            applicants: kpiRow?.applicants ?? 0,
            interviews: kpiRow?.interviews ?? 0,
            offers: kpiRow?.offers ?? 0,
          },
          catalog: catalogRows.map((row) => ({
            ...row,
            experienceLevel: row.experienceLevel as ExperienceLevel,
            status: row.status as JobStatus,
            stakeAmount: numericValue(row.stakeAmount),
            stakeToken: row.stakeToken as TokenSymbol,
            createdAt: timestamp(row.createdAt),
          })),
          activity: activityRows,
          matchDistribution: matchRows,
          pipeline: pipelineRows,
          recentApplicants: applicantRows.map(
            ({ application, jobTitle, profile, evaluationMatchScore }) => ({
              id: application.id,
              jobId: application.jobId,
              jobTitle,
              candidateUserId: application.candidateUserId,
              status: application.status,
              matchScore: evaluationMatchScore ?? application.matchScore,
              createdAt: timestamp(application.createdAt),
              candidate: candidateApplicationSummary(profile),
            }),
          ),
          talentRegions: regionRows,
        };
      } catch (error) {
        throw new RecruiterDashboardRepositoryError(
          "Failed to load recruiter dashboard.",
          { cause: error },
        );
      }
    },
  };
}
