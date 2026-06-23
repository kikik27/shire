import { NextResponse } from "next/server";

import {
  AuthenticatedUserConfigurationError,
  AuthenticatedUserError,
  resolveAuthenticatedUser,
  type AuthenticatedUser,
} from "@/lib/server/authenticated-user";
import { DatabaseConfigurationError } from "@/lib/server/db";
import {
  createDrizzleJobsRepository,
  JobsRepositoryError,
  type JobsRepository,
} from "@/lib/server/jobs-repository";
import {
  createDrizzleProfileRepository,
  ProfileRepositoryError,
  type ProfileRepository,
} from "@/lib/server/profile-repository";

export const runtime = "nodejs";
const AGENT_ENQUEUE_TIMEOUT_MS = 15_000;

function agentConfig() {
  const url = process.env.SHIRE_AGENT_INTERNAL_URL?.trim().replace(/\/+$/, "");
  const token = process.env.SHIRE_AGENT_SERVICE_TOKEN?.trim();
  return url && token ? { url, token } : undefined;
}

type RecruiterTalentMatchingRouteDependencies = {
  resolveAuthenticatedUser?: (request: Request) => Promise<AuthenticatedUser>;
  profileRepository?: ProfileRepository;
  jobsRepository?: JobsRepository;
  fetch?: typeof fetch;
};

export function createRecruiterTalentMatchingRefreshHandler(
  dependencies: RecruiterTalentMatchingRouteDependencies = {},
) {
  return async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
  ) {
    let stage = "authenticate";
    try {
      const authenticatedUser = await (
        dependencies.resolveAuthenticatedUser ?? resolveAuthenticatedUser
      )(request);
      const { id: jobId } = await params;

      stage = "resolve-user";
      const profiles =
        dependencies.profileRepository ?? createDrizzleProfileRepository();
      const user = await profiles.resolveUser(authenticatedUser.privyUserId);

      // Verify the recruiter owns this job before triggering matching for it.
      stage = "verify-ownership";
      const jobsRepository =
        dependencies.jobsRepository ?? createDrizzleJobsRepository();
      const recruiterJobs = await jobsRepository.listJobsByRecruiter(user.id);
      if (!recruiterJobs.some((job) => job.id === jobId)) {
        return NextResponse.json(
          { error: "job-not-found" },
          { status: 404 },
        );
      }

      const config = agentConfig();
      if (!config) {
        return NextResponse.json(
          { error: "missing-agent-configuration" },
          { status: 500 },
        );
      }

      // Enqueue a talent-matching job. The agent resolves confirmed candidates
      // from Postgres and writes TALENT_TO_COMPANY recommendations for this job.
      stage = "forward-agent";
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        AGENT_ENQUEUE_TIMEOUT_MS,
      );
      let upstream: Response;
      try {
        upstream = await (dependencies.fetch ?? fetch)(
          `${config.url}/jobs`,
          {
            method: "POST",
            headers: {
              authorization: `Bearer ${config.token}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              name: "talent-matching",
              payload: { jobId },
            }),
            signal: controller.signal,
          },
        );
      } finally {
        clearTimeout(timeout);
      }

      return new Response(await upstream.arrayBuffer(), {
        status: upstream.status,
        headers: {
          "content-type":
            upstream.headers.get("content-type") ?? "application/json",
        },
      });
    } catch (error) {
      if (error instanceof AuthenticatedUserConfigurationError) {
        return NextResponse.json(
          { error: "authentication-configuration-error" },
          { status: 500 },
        );
      }
      if (error instanceof AuthenticatedUserError) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }
      if (error instanceof DatabaseConfigurationError) {
        return NextResponse.json(
          { error: "missing-database-configuration" },
          { status: 500 },
        );
      }
      if (
        error instanceof ProfileRepositoryError ||
        error instanceof JobsRepositoryError
      ) {
        return NextResponse.json({ error: "database-error" }, { status: 500 });
      }
      console.error("[shire-web:talent-matching-refresh] request failed", {
        stage,
        error: error instanceof Error ? error.message : String(error),
      });
      const isTimeout = error instanceof Error && error.name === "AbortError";
      return NextResponse.json(
        { error: isTimeout ? "agent-timeout" : "agent-unreachable" },
        { status: isTimeout ? 504 : 502 },
      );
    }
  };
}

export const POST = createRecruiterTalentMatchingRefreshHandler();
