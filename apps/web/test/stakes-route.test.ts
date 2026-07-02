import assert from "node:assert/strict";
import test from "node:test";

import {
  createInMemoryStakesRepository,
  StakeTransitionError,
} from "../lib/server/stakes-repository";
import { createStakesRouteHandlers } from "../lib/server/stakes-route";
import { createInMemoryAuthorizationUserRepository } from "../lib/server/authorization";
import { createInMemoryJobsRepository } from "../lib/server/jobs-repository";

const input = {
  ownerUserId: "user-1",
  type: "APPLICATION" as const,
  amount: 10,
  token: "cUSD" as const,
  idempotencyKey: "application:job-1",
  jobId: "job-1",
};

test("stake creation is idempotent by authenticated actor and key", async () => {
  const repository = createInMemoryStakesRepository();

  const first = await repository.createStake(input);
  const second = await repository.createStake(input);

  assert.equal(second.id, first.id);
  assert.deepEqual(second, first);
});

test("refunding a slashed stake returns a conflict", async () => {
  const repository = createInMemoryStakesRepository();
  const stake = await repository.createStake(input);
  await repository.transitionStake(stake.id, "SLASHED", "admin-1", "Fraud");

  await assert.rejects(
    repository.transitionStake(stake.id, "REFUNDED", "admin-1"),
    (error: unknown) =>
      error instanceof StakeTransitionError &&
      error.code === "invalid-transition",
  );
});

test("stake route accepts owned jobs and rejects foreign jobs", async () => {
  const users = createInMemoryAuthorizationUserRepository([
    { id: "recruiter-1", privyUserId: "did:privy:recruiter", userType: "USER" },
  ]);
  const jobs = createInMemoryJobsRepository();
  const ownJob = await jobs.createJob("recruiter-1", {
    title: "Protocol Engineer",
    description:
      "Build production protocol systems and improve platform reliability.",
    location: "Remote",
    remote: true,
    salaryRange: "$100k-$140k",
    jobType: "FULL_TIME",
    experienceLevel: "SENIOR",
    skillsRequired: ["TypeScript"],
    candidateStakeRequired: false,
  });
  const foreignJob = await jobs.createJob("recruiter-2", {
    title: "Product Engineer",
    description:
      "Build production product systems and improve platform reliability.",
    location: "Remote",
    remote: true,
    salaryRange: "$90k-$130k",
    jobType: "FULL_TIME",
    experienceLevel: "MID",
    skillsRequired: ["React"],
    candidateStakeRequired: false,
  });
  const handlers = createStakesRouteHandlers({
    authorization: {
      authenticate: async () =>
        ({ mode: "privy", privyUserId: "did:privy:recruiter" }) as const,
      users,
    },
    stakesRepository: createInMemoryStakesRepository(),
    jobsRepository: jobs,
  });
  const request = (jobId: string) =>
    new Request("http://localhost/api/stakes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "JOB_POST",
        amount: 25,
        token: "cUSD",
        idempotencyKey: `job:${jobId}:publish`,
        jobId,
      }),
    });

  const first = await handlers.POST(request(ownJob.id));
  const second = await handlers.POST(request(ownJob.id));
  const forbidden = await handlers.POST(request(foreignJob.id));

  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  assert.equal(
    (await first.clone().json()).stake.id,
    (await second.json()).stake.id,
  );
  assert.equal((await jobs.getJob(ownJob.id))?.stakeAmount, 25);
  assert.equal(forbidden.status, 403);
});
