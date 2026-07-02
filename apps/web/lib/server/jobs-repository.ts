import { and, desc, eq, ne } from "drizzle-orm";

import type { ExperienceLevel, JobStatus, JobType, RiskLevel, TokenSymbol } from "../types";
import { createDatabase, type Database } from "./db";
import { jobs } from "./db/schema";

export type PersistedJob = {
  id: string;
  recruiterUserId: string;
  title: string;
  description: string;
  companyName: string;
  location: string;
  remote: boolean;
  salaryRange: string;
  jobType: JobType;
  experienceLevel: ExperienceLevel;
  skillsRequired: string[];
  status: JobStatus;
  stakeAmount: number;
  stakeToken: TokenSymbol;
  candidateStakeRequired: boolean;
  candidateStakeAmount?: number;
  riskLevel: RiskLevel;
  riskScore: number;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
};

export type CreateJobInput = {
  title: string;
  description: string;
  companyName?: string;
  location: string;
  remote: boolean;
  salaryRange: string;
  jobType: JobType;
  experienceLevel: ExperienceLevel;
  skillsRequired: string[];
  candidateStakeRequired: boolean;
  candidateStakeAmount?: number;
};

export interface JobsRepository {
  createJob(recruiterUserId: string, input: CreateJobInput): Promise<PersistedJob>;
  listJobsByRecruiter(recruiterUserId: string): Promise<PersistedJob[]>;
  listActiveJobs(options?: { excludeRecruiterUserId?: string }): Promise<PersistedJob[]>;
  getJob(id: string): Promise<PersistedJob | null>;
  updateJobStatus(id: string, status: JobStatus): Promise<PersistedJob>;
  recordJobStake(
    id: string,
    amount: number,
    token: TokenSymbol,
  ): Promise<PersistedJob>;
}

export class JobsRepositoryError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "JobsRepositoryError";
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

export function mapJob(row: typeof jobs.$inferSelect): PersistedJob {
  return {
    id: row.id,
    recruiterUserId: row.recruiterUserId,
    title: row.title,
    description: row.description,
    companyName: row.companyName,
    location: row.location,
    remote: row.remote,
    salaryRange: row.salaryRange,
    jobType: row.jobType as JobType,
    experienceLevel: row.experienceLevel as ExperienceLevel,
    skillsRequired: row.skillsRequired,
    status: row.status,
    stakeAmount: numericValue(row.stakeAmount) ?? 0,
    stakeToken: row.stakeToken as TokenSymbol,
    candidateStakeRequired: row.candidateStakeRequired,
    candidateStakeAmount: numericValue(row.candidateStakeAmount),
    riskLevel: row.riskLevel as RiskLevel,
    riskScore: row.riskScore,
    createdAt: toTimestamp(row.createdAt),
    updatedAt: toTimestamp(row.updatedAt),
    expiresAt: toTimestamp(row.expiresAt),
  };
}

function expiryDate() {
  return new Date(Date.now() + 30 * 86400000);
}

export function createDrizzleJobsRepository(database: Database = createDatabase()): JobsRepository {
  return {
    async createJob(recruiterUserId, input) {
      try {
        const [row] = await database
          .insert(jobs)
          .values({
            recruiterUserId,
            title: input.title,
            description: input.description,
            companyName: input.companyName ?? "Your company",
            location: input.location,
            remote: input.remote,
            salaryRange: input.salaryRange,
            jobType: input.jobType,
            experienceLevel: input.experienceLevel,
            skillsRequired: input.skillsRequired,
            candidateStakeRequired: input.candidateStakeRequired,
            candidateStakeAmount:
              input.candidateStakeAmount === undefined
                ? null
                : String(input.candidateStakeAmount),
            expiresAt: expiryDate(),
          })
          .returning();
        if (!row) {
          throw new Error("Job insert returned no row.");
        }
        return mapJob(row);
      } catch (error) {
        throw new JobsRepositoryError("Failed to create job.", { cause: error });
      }
    },
    async listJobsByRecruiter(recruiterUserId) {
      try {
        const rows = await database
          .select()
          .from(jobs)
          .where(eq(jobs.recruiterUserId, recruiterUserId))
          .orderBy(desc(jobs.createdAt));
        return rows.map(mapJob);
      } catch (error) {
        throw new JobsRepositoryError("Failed to list recruiter jobs.", { cause: error });
      }
    },
    async listActiveJobs(options) {
      try {
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
          )
          .orderBy(desc(jobs.createdAt));
        return rows.map(mapJob);
      } catch (error) {
        throw new JobsRepositoryError("Failed to list active jobs.", { cause: error });
      }
    },
    async getJob(id) {
      try {
        const [row] = await database.select().from(jobs).where(eq(jobs.id, id)).limit(1);
        return row ? mapJob(row) : null;
      } catch (error) {
        throw new JobsRepositoryError("Failed to load job.", { cause: error });
      }
    },
    async updateJobStatus(id, status) {
      try {
        const [row] = await database
          .update(jobs)
          .set({ status, updatedAt: new Date() })
          .where(eq(jobs.id, id))
          .returning();
        if (!row) {
          throw new JobsRepositoryError("Job was not found.");
        }
        return mapJob(row);
      } catch (error) {
        if (error instanceof JobsRepositoryError) {
          throw error;
        }
        throw new JobsRepositoryError("Failed to update job status.", { cause: error });
      }
    },
    async recordJobStake(id, amount, token) {
      try {
        const [row] = await database
          .update(jobs)
          .set({
            stakeAmount: String(amount),
            stakeToken: token,
            updatedAt: new Date(),
          })
          .where(eq(jobs.id, id))
          .returning();
        if (!row) {
          throw new JobsRepositoryError("Job was not found.");
        }
        return mapJob(row);
      } catch (error) {
        if (error instanceof JobsRepositoryError) throw error;
        throw new JobsRepositoryError("Failed to record job stake.", {
          cause: error,
        });
      }
    },
  };
}

export function createInMemoryJobsRepository(): JobsRepository {
  const savedJobs = new Map<string, PersistedJob>();

  function sorted(rows: PersistedJob[]) {
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  }

  return {
    async createJob(recruiterUserId, input) {
      const now = Date.now();
      const job: PersistedJob = {
        id: crypto.randomUUID(),
        recruiterUserId,
        title: input.title,
        description: input.description,
        companyName: input.companyName ?? "Your company",
        location: input.location,
        remote: input.remote,
        salaryRange: input.salaryRange,
        jobType: input.jobType,
        experienceLevel: input.experienceLevel,
        skillsRequired: input.skillsRequired,
        status: "DRAFT",
        stakeAmount: 0,
        stakeToken: "cUSD",
        candidateStakeRequired: input.candidateStakeRequired,
        candidateStakeAmount: input.candidateStakeAmount,
        riskLevel: "UNKNOWN",
        riskScore: 0,
        createdAt: now,
        updatedAt: now,
        expiresAt: now + 30 * 86400000,
      };
      savedJobs.set(job.id, job);
      return job;
    },
    async listJobsByRecruiter(recruiterUserId) {
      return sorted([...savedJobs.values()].filter((job) => job.recruiterUserId === recruiterUserId));
    },
    async listActiveJobs(options) {
      return sorted(
        [...savedJobs.values()].filter(
          (job) =>
            job.status === "ACTIVE" &&
            job.recruiterUserId !== options?.excludeRecruiterUserId,
        ),
      );
    },
    async getJob(id) {
      return savedJobs.get(id) ?? null;
    },
    async updateJobStatus(id, status) {
      const job = savedJobs.get(id);
      if (!job) {
        throw new JobsRepositoryError("Job was not found.");
      }
      const updated = { ...job, status, updatedAt: Date.now() };
      savedJobs.set(id, updated);
      return updated;
    },
    async recordJobStake(id, amount, token) {
      const job = savedJobs.get(id);
      if (!job) {
        throw new JobsRepositoryError("Job was not found.");
      }
      const updated = {
        ...job,
        stakeAmount: amount,
        stakeToken: token,
        updatedAt: Date.now(),
      };
      savedJobs.set(id, updated);
      return updated;
    },
  };
}
