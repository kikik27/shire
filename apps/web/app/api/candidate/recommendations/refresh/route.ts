import { NextResponse } from "next/server";

import {
  AuthenticatedUserConfigurationError,
  AuthenticatedUserError,
  resolveAuthenticatedUser,
  type AuthenticatedUser,
} from "@/lib/server/authenticated-user";
import { DatabaseConfigurationError } from "@/lib/server/db";
import {
  createDrizzleProfileRepository,
  ProfileRepositoryError,
  type ProfileRepository,
} from "@/lib/server/profile-repository";

export const runtime = "nodejs";

function agentConfig() {
  const url = process.env.SHIRE_AGENT_INTERNAL_URL?.trim().replace(/\/+$/, "");
  const token = process.env.SHIRE_AGENT_SERVICE_TOKEN?.trim();
  return url && token ? { url, token } : undefined;
}

type CandidateMatchingRouteDependencies = {
  resolveAuthenticatedUser?: (request: Request) => Promise<AuthenticatedUser>;
  repository?: ProfileRepository;
  fetch?: typeof fetch;
};

export function createCandidateMatchingRefreshHandler(
  dependencies: CandidateMatchingRouteDependencies = {},
) {
  return async function POST(request: Request) {
    let stage = "authenticate";
    try {
      const authenticatedUser = await (
        dependencies.resolveAuthenticatedUser ?? resolveAuthenticatedUser
      )(request);
      stage = "resolve-user";
      const repository =
        dependencies.repository ?? createDrizzleProfileRepository();
      const user = await repository.resolveUser(authenticatedUser.privyUserId);

      const config = agentConfig();
      if (!config) {
        return NextResponse.json(
          { error: "missing-agent-configuration" },
          { status: 500 },
        );
      }

      // Enqueue a job-matching job for this candidate. The agent resolves the
      // candidate profile + active jobs from Postgres and writes recommendations.
      stage = "forward-agent";
      const upstream = await (dependencies.fetch ?? fetch)(
        `${config.url}/jobs`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${config.token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            name: "job-matching",
            payload: { candidateId: user.id },
          }),
        },
      );

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
      if (error instanceof ProfileRepositoryError) {
        return NextResponse.json({ error: "database-error" }, { status: 500 });
      }
      console.error("[shire-web:matching-refresh] request failed", {
        stage,
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: "agent-unreachable" }, { status: 502 });
    }
  };
}

export const POST = createCandidateMatchingRefreshHandler();
