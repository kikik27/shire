import assert from "node:assert/strict";
import test from "node:test";

import {
  ApplicationsRepositoryError,
  createInMemoryApplicationsRepository,
} from "../lib/server/applications-repository";
import { createInMemoryJobsRepository } from "../lib/server/jobs-repository";

const jobInput = {
  title: "Senior Protocol Engineer",
  description:
    "Build secure protocol infrastructure and partner with product teams on hiring workflows.",
  location: "Remote",
  remote: true,
  salaryRange: "$120k-$160k",
  jobType: "FULL_TIME" as const,
  experienceLevel: "SENIOR" as const,
  skillsRequired: ["TypeScript", "Soroban"],
  candidateStakeRequired: false,
};

test("applications repository lets a candidate apply to an active job", async () => {
  const jobs = createInMemoryJobsRepository();
  const job = await jobs.createJob("recruiter-1", jobInput);
  await jobs.updateJobStatus(job.id, "ACTIVE");
  const applications = createInMemoryApplicationsRepository(jobs);

  const application = await applications.applyToJob("candidate-1", job.id, {
    message: "I have shipped production TypeScript systems.",
    stakeAmount: 10,
  });

  assert.equal(application.jobId, job.id);
  assert.equal(application.candidateUserId, "candidate-1");
  assert.equal(application.status, "APPLIED");
  assert.equal(application.stakeAmount, 10);
  assert.deepEqual(await applications.listApplicationsByCandidate("candidate-1"), [
    application,
  ]);
  assert.deepEqual(await applications.listApplicationsByJob(job.id), [
    application,
  ]);
});

test("applications repository prevents recruiter self-apply", async () => {
  const jobs = createInMemoryJobsRepository();
  const job = await jobs.createJob("same-user", jobInput);
  await jobs.updateJobStatus(job.id, "ACTIVE");
  const applications = createInMemoryApplicationsRepository(jobs);

  await assert.rejects(
    applications.applyToJob("same-user", job.id, {
      message: "Applying to my own job should fail.",
    }),
    ApplicationsRepositoryError,
  );
});

test("applications repository prevents duplicate applications", async () => {
  const jobs = createInMemoryJobsRepository();
  const job = await jobs.createJob("recruiter-1", jobInput);
  await jobs.updateJobStatus(job.id, "ACTIVE");
  const applications = createInMemoryApplicationsRepository(jobs);

  await applications.applyToJob("candidate-1", job.id, {
    message: "First application.",
  });

  await assert.rejects(
    applications.applyToJob("candidate-1", job.id, {
      message: "Duplicate application.",
    }),
    ApplicationsRepositoryError,
  );
});
