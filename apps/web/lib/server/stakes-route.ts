import { NextResponse } from "next/server";
import { z } from "zod";
import { PLATFORM_STAKE_TYPES } from "@shire/shared";

import {
  createDrizzleApplicationsRepository,
  type ApplicationsRepository,
} from "./applications-repository";
import {
  type AuthorizationDependencies,
  resolveAuthorizedUser,
} from "./authorization";
import {
  createDrizzleJobsRepository,
  type JobsRepository,
} from "./jobs-repository";
import {
  createDrizzleStakesRepository,
  StakeConflictError,
  type StakesRepository,
} from "./stakes-repository";
import { serverErrorResponse } from "./route-errors";

const createStakeSchema = z
  .strictObject({
    type: z.enum(PLATFORM_STAKE_TYPES),
    amount: z.number().positive(),
    token: z.enum(["cUSD", "USDC", "CELO"]),
    idempotencyKey: z.string().min(1).max(200),
    jobId: z.string().uuid().optional(),
    applicationId: z.string().uuid().optional(),
    reason: z.string().max(500).optional(),
  })
  .superRefine((value, context) => {
    if (value.type === "JOB_POST" && !value.jobId) {
      context.addIssue({
        code: "custom",
        message: "JOB_POST stakes require jobId.",
      });
    }
    if (value.type === "APPLICATION" && !value.applicationId) {
      context.addIssue({
        code: "custom",
        message: "APPLICATION stakes require applicationId.",
      });
    }
  });

export type StakesRouteDependencies = {
  authorization?: AuthorizationDependencies;
  stakesRepository?: StakesRepository;
  jobsRepository?: JobsRepository;
  applicationsRepository?: ApplicationsRepository;
};

export function createStakesRouteHandlers(
  dependencies: StakesRouteDependencies = {},
) {
  const authorization = dependencies.authorization;
  const stakes = () =>
    dependencies.stakesRepository ?? createDrizzleStakesRepository();
  const jobs = () => dependencies.jobsRepository ?? createDrizzleJobsRepository();
  const applications = () =>
    dependencies.applicationsRepository ?? createDrizzleApplicationsRepository();

  async function GET(request: Request) {
    try {
      const user = await resolveAuthorizedUser(request, authorization);
      return NextResponse.json({
        stakes: await stakes().listStakesByOwner(user.id),
      });
    } catch (error) {
      return serverErrorResponse(error);
    }
  }

  async function POST(request: Request) {
    try {
      const user = await resolveAuthorizedUser(request, authorization);
      const parsed = createStakeSchema.safeParse(
        await request.json().catch(() => undefined),
      );
      if (!parsed.success) {
        return NextResponse.json({ error: "invalid-stake" }, { status: 400 });
      }
      if (parsed.data.jobId) {
        const job = await jobs().getJob(parsed.data.jobId);
        const ownsJob =
          parsed.data.type === "JOB_POST" &&
          job?.recruiterUserId === user.id;
        if (!job || (!ownsJob && parsed.data.type === "JOB_POST")) {
          return NextResponse.json({ error: "forbidden" }, { status: 403 });
        }
      }
      if (parsed.data.applicationId) {
        const application = await applications().getApplication(
          parsed.data.applicationId,
        );
        if (
          !application ||
          application.candidateUserId !== user.id ||
          (parsed.data.jobId && application.jobId !== parsed.data.jobId)
        ) {
          return NextResponse.json({ error: "forbidden" }, { status: 403 });
        }
      }
      const stake = await stakes().createStake({
        ...parsed.data,
        ownerUserId: user.id,
      });
      if (stake.type === "JOB_POST" && stake.jobId) {
        await jobs().recordJobStake(stake.jobId, stake.amount, stake.token);
      }
      return NextResponse.json({ stake }, { status: 201 });
    } catch (error) {
      if (error instanceof StakeConflictError) {
        return NextResponse.json(
          { error: error.code },
          { status: 409 },
        );
      }
      return serverErrorResponse(error);
    }
  }

  return { GET, POST };
}
