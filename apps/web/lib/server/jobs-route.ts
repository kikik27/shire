import { NextResponse } from "next/server";
import { z } from "zod";

import { jobDraftSchema } from "../schemas";
import {
  AuthenticatedUserError,
  resolveAuthenticatedUser,
  type AuthenticatedUser,
} from "./authenticated-user";
import {
  createDrizzleJobsRepository,
  JobsRepositoryError,
  type JobsRepository,
} from "./jobs-repository";
import {
  createDrizzleProfileRepository,
  type ProfileRepository,
} from "./profile-repository";
import {
  createDrizzleRecommendationsRepository,
  type CandidateJobRecommendationRepository,
} from "./recommendations-repository";
import { serverErrorResponse } from "./route-errors";

type ResolveAuthenticatedUser = (request: Request) => Promise<AuthenticatedUser>;
type JobRouteContext = { params: Promise<{ id: string }> };
const patchJobSchema = z.strictObject({
  status: z.enum(["DRAFT", "ACTIVE", "CLOSED", "EXPIRED", "FLAGGED"]),
});

export type JobsRouteDependencies = {
  resolveAuthenticatedUser?: ResolveAuthenticatedUser;
  profileRepository?: ProfileRepository;
  jobsRepository?: JobsRepository;
};

export type CandidateJobRouteDependencies = JobsRouteDependencies & {
  recommendationsRepository?: CandidateJobRecommendationRepository;
};

async function authenticatedUserId(
  request: Request,
  authenticate: ResolveAuthenticatedUser,
  profiles: ProfileRepository,
) {
  const authenticated = await authenticate(request);
  const user = await profiles.resolveUser(
    authenticated.privyUserId,
    authenticated.walletAddress,
  );
  return user.id;
}

export function createJobsRouteHandlers(dependencies: JobsRouteDependencies = {}) {
  const authenticate =
    dependencies.resolveAuthenticatedUser ?? resolveAuthenticatedUser;
  const profiles = () =>
    dependencies.profileRepository ?? createDrizzleProfileRepository();
  const jobs = () => dependencies.jobsRepository ?? createDrizzleJobsRepository();

  async function GET(request: Request) {
    try {
      const userId = await authenticatedUserId(request, authenticate, profiles());
      return NextResponse.json({
        jobs: await jobs().listJobsByRecruiter(userId),
      });
    } catch (error) {
      return serverErrorResponse(error);
    }
  }

  async function POST(request: Request) {
    try {
      const userId = await authenticatedUserId(request, authenticate, profiles());
      const payload = await request.json().catch(() => undefined);
      const parsed = jobDraftSchema.safeParse(payload);
      if (!parsed.success) {
        return NextResponse.json({ error: "invalid-job" }, { status: 400 });
      }
      const job = await jobs().createJob(userId, parsed.data);
      return NextResponse.json({ job }, { status: 201 });
    } catch (error) {
      if (
        error instanceof AuthenticatedUserError ||
        error instanceof JobsRepositoryError
      ) {
        return serverErrorResponse(error);
      }
      return serverErrorResponse(error);
    }
  }

  async function PATCH(request: Request, context: JobRouteContext) {
    try {
      const userId = await authenticatedUserId(request, authenticate, profiles());
      const { id } = await context.params;
      const existing = await jobs().getJob(id);
      if (!existing) {
        return NextResponse.json({ error: "job-not-found" }, { status: 404 });
      }
      if (existing.recruiterUserId !== userId) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }
      const payload = await request.json().catch(() => undefined);
      const parsed = patchJobSchema.safeParse(payload);
      if (!parsed.success) {
        return NextResponse.json({ error: "invalid-job" }, { status: 400 });
      }
      const job = await jobs().updateJobStatus(id, parsed.data.status);
      return NextResponse.json({ job });
    } catch (error) {
      return serverErrorResponse(error);
    }
  }

  return { GET, POST, PATCH };
}

export function createCandidateJobsRouteHandlers(
  dependencies: JobsRouteDependencies = {},
) {
  const authenticate =
    dependencies.resolveAuthenticatedUser ?? resolveAuthenticatedUser;
  const profiles = () =>
    dependencies.profileRepository ?? createDrizzleProfileRepository();
  const jobs = () => dependencies.jobsRepository ?? createDrizzleJobsRepository();

  async function GET(request: Request) {
    try {
      const userId = await authenticatedUserId(request, authenticate, profiles());
      return NextResponse.json({
        jobs: await jobs().listActiveJobs({ excludeRecruiterUserId: userId }),
      });
    } catch (error) {
      return serverErrorResponse(error);
    }
  }

  return { GET };
}

export function createCandidateJobRouteHandlers(
  dependencies: CandidateJobRouteDependencies = {},
) {
  const authenticate =
    dependencies.resolveAuthenticatedUser ?? resolveAuthenticatedUser;
  const profiles = () =>
    dependencies.profileRepository ?? createDrizzleProfileRepository();
  const jobs = () => dependencies.jobsRepository ?? createDrizzleJobsRepository();
  const recommendations = () =>
    dependencies.recommendationsRepository ??
    createDrizzleRecommendationsRepository();

  async function GET(request: Request, context: JobRouteContext) {
    try {
      const userId = await authenticatedUserId(request, authenticate, profiles());
      const { id } = await context.params;
      const job = await jobs().getJob(id);
      if (
        !job ||
        job.status !== "ACTIVE" ||
        job.recruiterUserId === userId
      ) {
        return NextResponse.json({ error: "job-not-found" }, { status: 404 });
      }
      const recommendation =
        await recommendations().getCandidateJobRecommendation(userId, id);
      return NextResponse.json({
        job,
        match: recommendation
          ? {
              score: recommendation.matchScore,
              confidence: recommendation.confidence,
              reasons: recommendation.reasons,
              missingRequirements: recommendation.missingRequirements,
              recommendedAction: recommendation.recommendedAction,
            }
          : null,
      });
    } catch (error) {
      return serverErrorResponse(error);
    }
  }

  return { GET };
}
