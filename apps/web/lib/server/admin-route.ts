import { NextResponse } from "next/server";
import { z } from "zod";

import {
  AdminConflictError,
  AdminEntityNotFoundError,
  createDrizzleAdminRepository,
  type AdminRepository,
} from "./admin-repository";
import {
  AuthorizationError,
  requireAdmin,
  type AuthorizationDependencies,
} from "./authorization";
import { serverErrorResponse } from "./route-errors";

const jobMutationSchema = z.strictObject({
  id: z.string().uuid(),
  action: z.enum(["approve", "flag", "close"]),
});

const stakeMutationSchema = z.strictObject({
  id: z.string().uuid(),
  status: z.enum(["REFUNDED", "SLASHED", "RELEASED", "CANCELLED"]),
  reason: z.string().max(500).optional(),
});

const disputeMutationSchema = z.strictObject({
  id: z.string().uuid(),
  status: z.enum(["RESOLVED", "REJECTED"]),
  decision: z.string().min(1).max(2000),
  stakeStatus: z.enum(["REFUNDED", "SLASHED"]).optional(),
});

export type AdminRouteDependencies = {
  authorization?: AuthorizationDependencies;
  adminRepository?: AdminRepository;
};

export function createAdminRouteHandlers(
  dependencies: AdminRouteDependencies = {},
) {
  const authorization = dependencies.authorization;
  const admin = () =>
    dependencies.adminRepository ?? createDrizzleAdminRepository();

  async function execute(
    request: Request,
    operation: (actorUserId: string) => Promise<Response>,
  ) {
    try {
      const actor = await requireAdmin(request, authorization);
      return await operation(actor.id);
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return NextResponse.json({ error: error.code }, { status: 403 });
      }
      if (error instanceof AdminEntityNotFoundError) {
        return NextResponse.json({ error: error.code }, { status: 404 });
      }
      if (error instanceof AdminConflictError) {
        return NextResponse.json({ error: error.code }, { status: 409 });
      }
      return serverErrorResponse(error);
    }
  }

  const GET_OVERVIEW = (request: Request) =>
    execute(request, async () =>
      NextResponse.json(await admin().getOverview()),
    );

  const GET_JOBS = (request: Request) =>
    execute(request, async () =>
      NextResponse.json({ jobs: await admin().listJobs() }),
    );

  const PATCH_JOB = (request: Request) =>
    execute(request, async (actorUserId) => {
      const parsed = jobMutationSchema.safeParse(
        await request.json().catch(() => undefined),
      );
      if (!parsed.success) {
        return NextResponse.json({ error: "invalid-job-action" }, { status: 400 });
      }
      return NextResponse.json({
        job: await admin().moderateJob(
          parsed.data.id,
          parsed.data.action,
          actorUserId,
        ),
      });
    });

  const GET_STAKES = (request: Request) =>
    execute(request, async () =>
      NextResponse.json({ stakes: await admin().listStakes() }),
    );

  const PATCH_STAKE = (request: Request) =>
    execute(request, async (actorUserId) => {
      const parsed = stakeMutationSchema.safeParse(
        await request.json().catch(() => undefined),
      );
      if (!parsed.success) {
        return NextResponse.json(
          { error: "invalid-stake-action" },
          { status: 400 },
        );
      }
      return NextResponse.json({
        stake: await admin().transitionStake(
          parsed.data.id,
          parsed.data.status,
          actorUserId,
          parsed.data.reason,
        ),
      });
    });

  const GET_DISPUTES = (request: Request) =>
    execute(request, async () =>
      NextResponse.json({ disputes: await admin().listDisputes() }),
    );

  const PATCH_DISPUTE = (request: Request) =>
    execute(request, async (actorUserId) => {
      const parsed = disputeMutationSchema.safeParse(
        await request.json().catch(() => undefined),
      );
      if (!parsed.success) {
        return NextResponse.json(
          { error: "invalid-dispute-action" },
          { status: 400 },
        );
      }
      return NextResponse.json({
        dispute: await admin().resolveDispute(
          parsed.data.id,
          parsed.data,
          actorUserId,
        ),
      });
    });

  return {
    GET_OVERVIEW,
    GET_JOBS,
    PATCH_JOB,
    GET_STAKES,
    PATCH_STAKE,
    GET_DISPUTES,
    PATCH_DISPUTE,
  };
}
