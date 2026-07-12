import assert from "node:assert/strict";
import test from "node:test";

import { createAdminRouteHandlers } from "../lib/server/admin-route";
import {
  createInMemoryAuthorizationUserRepository,
} from "../lib/server/authorization";
import { createInMemoryAuditRepository } from "../lib/server/audit-repository";
import { createInMemoryAdminRepository } from "../lib/server/admin-repository";
import { createInMemoryDisputesRepository } from "../lib/server/disputes-repository";
import { createInMemoryJobsRepository } from "../lib/server/jobs-repository";
import { createInMemoryStakesRepository } from "../lib/server/stakes-repository";

function authenticated(privyUserId: string) {
  return async () => ({ mode: "stellar", privyUserId, walletAddress: "GTESTAUTH" }) as const;
}

test("admin routes reject non-admin users", async () => {
  const users = createInMemoryAuthorizationUserRepository([
    { id: "user-1", privyUserId: "did:privy:user", userType: "USER" },
  ]);
  const handlers = createAdminRouteHandlers({
    authorization: {
      authenticate: authenticated("did:privy:user"),
      users,
    },
    adminRepository: createInMemoryAdminRepository(),
  });

  const response = await handlers.GET_OVERVIEW(
    new Request("http://localhost/api/admin/overview"),
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "admin-required" });
});

test("admin stake transitions are persisted with an audit record", async () => {
  const users = createInMemoryAuthorizationUserRepository([
    { id: "admin-1", privyUserId: "did:privy:admin", userType: "ADMIN" },
  ]);
  const stakes = createInMemoryStakesRepository();
  const stake = await stakes.createStake({
    ownerUserId: "user-1",
    type: "JOB_POST",
    amount: 25,
    token: "XLM",
    idempotencyKey: "job:job-1",
    jobId: "job-1",
  });
  const audit = createInMemoryAuditRepository();
  const admin = createInMemoryAdminRepository({
    jobs: createInMemoryJobsRepository(),
    stakes,
    disputes: createInMemoryDisputesRepository(),
    audit,
  });
  const handlers = createAdminRouteHandlers({
    authorization: {
      authenticate: authenticated("did:privy:admin"),
      users,
    },
    adminRepository: admin,
  });

  const response = await handlers.PATCH_STAKE(
    new Request("http://localhost/api/admin/stakes", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: stake.id,
        status: "REFUNDED",
        reason: "Role closed",
      }),
    }),
  );

  assert.equal(response.status, 200);
  assert.equal((await response.json()).stake.status, "REFUNDED");
  assert.deepEqual(
    (await audit.listAuditLogs()).map((entry) => entry.action),
    ["stake.refunded"],
  );
});

test("admin job moderation persists the status and audit", async () => {
  const users = createInMemoryAuthorizationUserRepository([
    { id: "admin-1", privyUserId: "did:privy:admin", userType: "ADMIN" },
  ]);
  const jobs = createInMemoryJobsRepository();
  const job = await jobs.createJob("recruiter-1", {
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
  const audit = createInMemoryAuditRepository();
  const handlers = createAdminRouteHandlers({
    authorization: {
      authenticate: authenticated("did:privy:admin"),
      users,
    },
    adminRepository: createInMemoryAdminRepository({ jobs, audit }),
  });

  const response = await handlers.PATCH_JOB(
    new Request("http://localhost/api/admin/jobs", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: job.id, action: "flag" }),
    }),
  );

  assert.equal(response.status, 200);
  assert.equal((await jobs.getJob(job.id))?.status, "FLAGGED");
  assert.deepEqual(
    (await audit.listAuditLogs()).map((entry) => entry.action),
    ["job.flag"],
  );
});

test("admin dispute resolution settles the linked stake and audits both", async () => {
  const users = createInMemoryAuthorizationUserRepository([
    { id: "admin-1", privyUserId: "did:privy:admin", userType: "ADMIN" },
  ]);
  const stakes = createInMemoryStakesRepository();
  const stake = await stakes.createStake({
    ownerUserId: "user-1",
    type: "APPLICATION",
    amount: 10,
    token: "XLM",
    idempotencyKey: "application:1",
  });
  const disputes = createInMemoryDisputesRepository();
  const dispute = await disputes.createDispute({
    reporterUserId: "user-2",
    stakeId: stake.id,
    reason: "Candidate stopped responding.",
  });
  const audit = createInMemoryAuditRepository();
  const handlers = createAdminRouteHandlers({
    authorization: {
      authenticate: authenticated("did:privy:admin"),
      users,
    },
    adminRepository: createInMemoryAdminRepository({
      stakes,
      disputes,
      audit,
    }),
  });

  const response = await handlers.PATCH_DISPUTE(
    new Request("http://localhost/api/admin/disputes", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: dispute.id,
        status: "RESOLVED",
        decision: "Evidence supports the report.",
        stakeStatus: "SLASHED",
      }),
    }),
  );

  assert.equal(response.status, 200);
  assert.equal((await stakes.getStake(stake.id))?.status, "SLASHED");
  assert.deepEqual(
    (await audit.listAuditLogs()).map((entry) => entry.action),
    ["stake.slashed", "dispute.resolved"],
  );
});
