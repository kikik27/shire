import { and, desc, eq } from "drizzle-orm";

import type {
  ApplicationJobSummary,
  ApplicationStatus,
  CandidateApplicationSummary,
} from "../types";
import { createDatabase, type Database } from "./db";
import { persistedCandidateProfileSchema } from "../schemas";
import {
  applications,
  candidateProfiles,
  jobs,
  matchingEvaluations,
} from "./db/schema";
import {
  createDrizzleJobsRepository,
  type JobsRepository,
} from "./jobs-repository";
import type { ProfileRepository } from "./profile-repository";

export type PersistedApplication = {
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
  candidate?: CandidateApplicationSummary;
  job?: ApplicationJobSummary;
};

export type ApplyToJobInput = {
  message: string;
  stakeAmount?: number;
  stakeTx?: string;
};

export interface ApplicationsRepository {
  applyToJob(
    candidateUserId: string,
    jobId: string,
    input: ApplyToJobInput,
  ): Promise<PersistedApplication>;
  listApplicationsByCandidate(candidateUserId: string): Promise<PersistedApplication[]>;
  listApplicationsByJob(jobId: string): Promise<PersistedApplication[]>;
  listApplicationsByRecruiter(
    recruiterUserId: string,
    limit?: number,
  ): Promise<PersistedApplication[]>;
  getApplication(id: string): Promise<PersistedApplication | null>;
  updateApplicationStatus(
    id: string,
    status: ApplicationStatus,
  ): Promise<PersistedApplication>;
}

export class ApplicationsRepositoryError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ApplicationsRepositoryError";
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

function mapApplication(row: typeof applications.$inferSelect): PersistedApplication {
  return {
    id: row.id,
    jobId: row.jobId,
    candidateUserId: row.candidateUserId,
    status: row.status,
    message: row.message,
    matchScore: row.matchScore,
    riskScore: row.riskScore,
    stakeTx: row.stakeTx ?? undefined,
    stakeAmount: numericValue(row.stakeAmount),
    createdAt: toTimestamp(row.createdAt),
    updatedAt: toTimestamp(row.updatedAt),
  };
}

export function candidateApplicationSummary(
  profile: unknown,
): CandidateApplicationSummary | undefined {
  const parsed = persistedCandidateProfileSchema.safeParse(profile);
  if (!parsed.success) {
    return undefined;
  }
  return {
    displayName: parsed.data.displayName,
    headline: parsed.data.roleTargets[0] ?? parsed.data.bio,
    skills: parsed.data.skills,
    location: parsed.data.location,
    portfolioUrl: parsed.data.portfolioUrl,
    githubUrl: parsed.data.githubUrl,
    linkedinUrl: parsed.data.linkedinUrl,
  };
}

function mapApplicationWithCandidate(row: {
  application: typeof applications.$inferSelect;
  profile: unknown | null;
  evaluationMatchScore?: number | null;
}): PersistedApplication {
  return {
    ...mapApplication(row.application),
    matchScore: row.evaluationMatchScore ?? row.application.matchScore,
    candidate: candidateApplicationSummary(row.profile),
  };
}

export function createDrizzleApplicationsRepository(
  database: Database = createDatabase(),
  jobsRepository: JobsRepository = createDrizzleJobsRepository(database),
): ApplicationsRepository {
  return {
    async applyToJob(candidateUserId, jobId, input) {
      try {
        const job = await jobsRepository.getJob(jobId);
        if (!job || job.status !== "ACTIVE") {
          throw new ApplicationsRepositoryError("Job is not open for applications.");
        }
        if (job.recruiterUserId === candidateUserId) {
          throw new ApplicationsRepositoryError("Recruiters cannot apply to their own jobs.");
        }
        const [existing] = await database
          .select({ id: applications.id })
          .from(applications)
          .where(
            and(
              eq(applications.jobId, jobId),
              eq(applications.candidateUserId, candidateUserId),
            ),
          )
          .limit(1);
        if (existing) {
          throw new ApplicationsRepositoryError("Candidate already applied to this job.");
        }
        const [row] = await database
          .insert(applications)
          .values({
            jobId,
            candidateUserId,
            message: input.message,
            riskScore: job.riskScore,
            stakeTx: input.stakeTx,
            stakeAmount:
              input.stakeAmount === undefined ? null : String(input.stakeAmount),
          })
          .returning();
        if (!row) {
          throw new Error("Application insert returned no row.");
        }
        return mapApplication(row);
      } catch (error) {
        if (error instanceof ApplicationsRepositoryError) {
          throw error;
        }
        throw new ApplicationsRepositoryError("Failed to apply to job.", { cause: error });
      }
    },
    async listApplicationsByCandidate(candidateUserId) {
      try {
        const rows = await database
          .select()
          .from(applications)
          .where(eq(applications.candidateUserId, candidateUserId))
          .orderBy(desc(applications.createdAt));
        return rows.map(mapApplication);
      } catch (error) {
        throw new ApplicationsRepositoryError("Failed to list candidate applications.", { cause: error });
      }
    },
    async listApplicationsByJob(jobId) {
      try {
        const rows = await database
          .select({
            application: applications,
            profile: candidateProfiles.profile,
            evaluationMatchScore: matchingEvaluations.matchScore,
          })
          .from(applications)
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
          .where(eq(applications.jobId, jobId))
          .orderBy(desc(applications.createdAt));
        return rows.map(mapApplicationWithCandidate);
      } catch (error) {
        throw new ApplicationsRepositoryError("Failed to list job applications.", { cause: error });
      }
    },
    async listApplicationsByRecruiter(recruiterUserId, limit = 50) {
      try {
        const rows = await database
          .select({
            application: applications,
            profile: candidateProfiles.profile,
            job: {
              title: jobs.title,
              companyName: jobs.companyName,
            },
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
          .limit(Math.min(Math.max(limit, 1), 100));
        return rows.map((row) => ({
          ...mapApplicationWithCandidate(row),
          job: row.job,
        }));
      } catch (error) {
        throw new ApplicationsRepositoryError(
          "Failed to list recruiter applications.",
          { cause: error },
        );
      }
    },
    async getApplication(id) {
      const [row] = await database
        .select()
        .from(applications)
        .where(eq(applications.id, id))
        .limit(1);
      return row ? mapApplication(row) : null;
    },
    async updateApplicationStatus(id, status) {
      try {
        const [row] = await database
          .update(applications)
          .set({ status, updatedAt: new Date() })
          .where(eq(applications.id, id))
          .returning();
        if (!row) {
          throw new ApplicationsRepositoryError("Application was not found.");
        }
        return mapApplication(row);
      } catch (error) {
        if (error instanceof ApplicationsRepositoryError) {
          throw error;
        }
        throw new ApplicationsRepositoryError("Failed to update application status.", { cause: error });
      }
    },
  };
}

export function createInMemoryApplicationsRepository(
  jobsRepository: JobsRepository,
  profilesRepository?: ProfileRepository,
): ApplicationsRepository {
  const savedApplications = new Map<string, PersistedApplication>();

  function sorted(rows: PersistedApplication[]) {
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  }

  async function withCandidate(
    application: PersistedApplication,
    includeJob = false,
  ) {
    if (!profilesRepository) {
      return application;
    }
    const job = includeJob
      ? await jobsRepository.getJob(application.jobId)
      : undefined;
    return {
      ...application,
      candidate: candidateApplicationSummary(
        await profilesRepository.getProfile(
          application.candidateUserId,
          "candidate",
        ),
      ),
      job: job
        ? { title: job.title, companyName: job.companyName }
        : undefined,
    };
  }

  return {
    async applyToJob(candidateUserId, jobId, input) {
      const job = await jobsRepository.getJob(jobId);
      if (!job || job.status !== "ACTIVE") {
        throw new ApplicationsRepositoryError("Job is not open for applications.");
      }
      if (job.recruiterUserId === candidateUserId) {
        throw new ApplicationsRepositoryError("Recruiters cannot apply to their own jobs.");
      }
      if (
        [...savedApplications.values()].some(
          (application) =>
            application.jobId === jobId &&
            application.candidateUserId === candidateUserId,
        )
      ) {
        throw new ApplicationsRepositoryError("Candidate already applied to this job.");
      }
      const now = Date.now();
      const application: PersistedApplication = {
        id: crypto.randomUUID(),
        jobId,
        candidateUserId,
        status: "APPLIED",
        message: input.message,
        matchScore: 0,
        riskScore: job.riskScore,
        stakeTx: input.stakeTx,
        stakeAmount: input.stakeAmount,
        createdAt: now,
        updatedAt: now,
      };
      savedApplications.set(application.id, application);
      return application;
    },
    async listApplicationsByCandidate(candidateUserId) {
      return sorted(
        [...savedApplications.values()].filter(
          (application) => application.candidateUserId === candidateUserId,
        ),
      );
    },
    async listApplicationsByJob(jobId) {
      const rows = sorted(
        [...savedApplications.values()].filter(
          (application) => application.jobId === jobId,
        ),
      );
      return Promise.all(rows.map((application) => withCandidate(application)));
    },
    async listApplicationsByRecruiter(recruiterUserId, limit = 50) {
      const ownedJobIds = new Set(
        (await jobsRepository.listJobsByRecruiter(recruiterUserId)).map(
          (job) => job.id,
        ),
      );
      const rows = sorted(
        [...savedApplications.values()].filter((application) =>
          ownedJobIds.has(application.jobId),
        ),
      ).slice(0, Math.min(Math.max(limit, 1), 100));
      return Promise.all(
        rows.map((application) => withCandidate(application, true)),
      );
    },
    async getApplication(id) {
      return savedApplications.get(id) ?? null;
    },
    async updateApplicationStatus(id, status) {
      const application = savedApplications.get(id);
      if (!application) {
        throw new ApplicationsRepositoryError("Application was not found.");
      }
      const updated = { ...application, status, updatedAt: Date.now() };
      savedApplications.set(id, updated);
      return updated;
    },
  };
}
