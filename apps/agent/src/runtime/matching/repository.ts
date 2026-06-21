import { and, eq, inArray, ne } from "drizzle-orm";

import type { AgentDatabase } from "../db/client";
import {
  agentRuns,
  applications,
  candidateProfiles,
  jobs,
  recommendations,
} from "../db/schema";
import {
  type CandidateMatchInput,
  type JobMatchInput,
  type MatchingRepository,
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

/** Extract the structured fields the scorer reads from the loose profile jsonb. */
function mapCandidate(
  row: typeof candidateProfiles.$inferSelect,
): CandidateMatchInput {
  const profile = (row.profile ?? {}) as Record<string, unknown>;
  const salary = profile.expectedSalary as Record<string, unknown> | undefined;

  return {
    userId: row.userId,
    fullName: asString(profile.fullName),
    headline: asString(profile.headline),
    summary: asString(profile.summary),
    skills: asStringArray(profile.skills),
    preferredRoles: asStringArray(profile.preferredRoles),
    expectedSalary: salary
      ? {
          min: asNumber(salary.min),
          max: asNumber(salary.max),
          currency: asString(salary.currency),
        }
      : undefined,
    location: asString(profile.location),
    workPreference: asString(profile.workPreference),
    portfolioUrl: asString(profile.portfolioUrl),
    githubUrl: asString(profile.githubUrl),
    linkedinUrl: asString(profile.linkedinUrl),
    yearsExperience: asNumber(profile.yearsExperience),
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
      return mapCandidate(row);
    },

    async listConfirmedCandidates() {
      const rows = await database
        .select()
        .from(candidateProfiles)
        .where(eq(candidateProfiles.profileStatus, "CONFIRMED"));
      return rows.map(mapCandidate);
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
        recruiterUserId: input.recruiterUserId ?? null,
        jobId: input.jobId ?? null,
        matchScore: input.matchScore,
        confidence:
          input.confidence === undefined ? null : String(input.confidence),
        reasons: input.reasons,
        missingRequirements: input.missingRequirements,
        riskFlags: input.riskFlags,
        recommendedAction: input.recommendedAction,
        status: "NEW" as const,
        updatedAt: new Date(),
      };

      const existing = await this.getRecommendation(
        input.candidateUserId,
        input.jobId ?? "",
        input.type,
      );
      if (existing) {
        await database
          .update(recommendations)
          .set(values)
          .where(eq(recommendations.id, existing.id));
        return existing.id;
      }

      const [row] = await database
        .insert(recommendations)
        .values(values)
        .returning({ id: recommendations.id });
      return row!.id;
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
export type RecommendationSnapshot = {
  candidateUserId: string;
  jobId?: string;
  matchScore: number;
  recommendedAction: string;
  type: "JOB_TO_CANDIDATE" | "TALENT_TO_COMPANY";
};

export function createInMemoryMatchingRepository(): MatchingRepository & {
  seedCandidate(candidate: CandidateMatchInput): void;
  seedJob(job: JobMatchInput): void;
  seedApplication(candidateUserId: string, jobId: string): void;
  snapshotRecommendations(): RecommendationSnapshot[];
} {
  const candidates = new Map<string, CandidateMatchInput>();
  const jobStore = new Map<string, JobMatchInput>();
  const applied = new Map<string, Set<string>>();
  const savedRecommendations: Array<{
    id: string;
    type: "JOB_TO_CANDIDATE" | "TALENT_TO_COMPANY";
    candidateUserId: string;
    jobId?: string;
    matchScore: number;
    recommendedAction: string;
  }> = [];

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
    async listAppliedJobIds(candidateUserId) {
      return new Set(applied.get(candidateUserId) ?? []);
    },
    async getRecommendation(candidateUserId, jobId, type) {
      const found = savedRecommendations.find(
        (recommendation) =>
          recommendation.candidateUserId === candidateUserId &&
          recommendation.jobId === jobId &&
          recommendation.type === type,
      );
      return found ? { id: found.id } : null;
    },
    async saveRecommendation(input) {
      const existing = await this.getRecommendation(
        input.candidateUserId,
        input.jobId ?? "",
        input.type,
      );
      if (existing) {
        const index = savedRecommendations.findIndex(
          (recommendation) => recommendation.id === existing.id,
        );
        savedRecommendations[index] = {
          ...savedRecommendations[index],
          matchScore: input.matchScore,
          recommendedAction: input.recommendedAction,
        };
        return existing.id;
      }
      const id = crypto.randomUUID();
      savedRecommendations.push({
        id,
        type: input.type,
        candidateUserId: input.candidateUserId,
        jobId: input.jobId,
        matchScore: input.matchScore,
        recommendedAction: input.recommendedAction,
      });
      return id;
    },
    async recordAgentRun() {
      // No-op: in-memory tests do not assert agent_runs rows.
    },
    snapshotRecommendations() {
      return savedRecommendations.map((recommendation) => ({
        candidateUserId: recommendation.candidateUserId,
        jobId: recommendation.jobId,
        matchScore: recommendation.matchScore,
        recommendedAction: recommendation.recommendedAction,
        type: recommendation.type,
      }));
    },
  };
}
