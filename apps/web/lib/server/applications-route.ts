import { NextResponse } from "next/server";

import { applyJobSchema } from "../schemas";
import {
  resolveAuthenticatedUser,
  type AuthenticatedUser,
} from "./authenticated-user";
import {
  ApplicationsRepositoryError,
  createDrizzleApplicationsRepository,
  type ApplicationsRepository,
} from "./applications-repository";
import {
  createDrizzleProfileRepository,
  type ProfileRepository,
} from "./profile-repository";
import {
  createDrizzleJobsRepository,
  type JobsRepository,
} from "./jobs-repository";
import { serverErrorResponse } from "./route-errors";

type ResolveAuthenticatedUser = (request: Request) => Promise<AuthenticatedUser>;
type RouteContext = { params: Promise<{ jobId: string }> };
type JobRouteContext = { params: Promise<{ id: string }> };

export type ApplicationsRouteDependencies = {
  resolveAuthenticatedUser?: ResolveAuthenticatedUser;
  profileRepository?: ProfileRepository;
  jobsRepository?: JobsRepository;
  applicationsRepository?: ApplicationsRepository;
};

async function authenticatedUserId(
  request: Request,
  authenticate: ResolveAuthenticatedUser,
  profiles: ProfileRepository,
) {
  const authenticated = await authenticate(request);
  const user = await profiles.resolveUser(
    authenticated.privyUserId,
    authenticated.mode === "privy" ? authenticated.walletAddress : undefined,
  );
  return user.id;
}

export function createApplicationsRouteHandlers(
  dependencies: ApplicationsRouteDependencies = {},
) {
  const authenticate =
    dependencies.resolveAuthenticatedUser ?? resolveAuthenticatedUser;
  const profiles = () =>
    dependencies.profileRepository ?? createDrizzleProfileRepository();
  const applications = () =>
    dependencies.applicationsRepository ?? createDrizzleApplicationsRepository();
  const jobs = () => dependencies.jobsRepository ?? createDrizzleJobsRepository();

  async function GET(request: Request) {
    try {
      const userId = await authenticatedUserId(request, authenticate, profiles());
      return NextResponse.json({
        applications: await applications().listApplicationsByCandidate(userId),
      });
    } catch (error) {
      return serverErrorResponse(error);
    }
  }

  async function POST(request: Request, context: RouteContext) {
    try {
      const userId = await authenticatedUserId(request, authenticate, profiles());
      const { jobId } = await context.params;
      const payload = await request.json().catch(() => undefined);
      const parsed = applyJobSchema.safeParse(payload);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "invalid-application" },
          { status: 400 },
        );
      }
      const application = await applications().applyToJob(userId, jobId, parsed.data);
      return NextResponse.json({ application }, { status: 201 });
    } catch (error) {
      if (error instanceof ApplicationsRepositoryError) {
        return NextResponse.json(
          { error: "application-error" },
          { status: 400 },
        );
      }
      return serverErrorResponse(error);
    }
  }

  async function GET_JOB(request: Request, context: JobRouteContext) {
    try {
      const userId = await authenticatedUserId(request, authenticate, profiles());
      const { id } = await context.params;
      const job = await jobs().getJob(id);
      if (!job) {
        return NextResponse.json({ error: "job-not-found" }, { status: 404 });
      }
      if (job.recruiterUserId !== userId) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }
      return NextResponse.json({
        applications: await applications().listApplicationsByJob(id),
      });
    } catch (error) {
      return serverErrorResponse(error);
    }
  }

  async function GET_RECRUITER(request: Request) {
    try {
      const userId = await authenticatedUserId(request, authenticate, profiles());
      return NextResponse.json({
        applications:
          await applications().listApplicationsByRecruiter(userId),
      });
    } catch (error) {
      return serverErrorResponse(error);
    }
  }

  return { GET, POST, GET_JOB, GET_RECRUITER };
}
