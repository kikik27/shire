import assert from "node:assert/strict";
import test from "node:test";

import {
  createInMemoryJobsRepository,
  JobsRepositoryError,
} from "../lib/server/jobs-repository";

const jobInput = {
  title: "Senior Protocol Engineer",
  description:
    "Build secure protocol infrastructure and partner with product teams on hiring workflows.",
  location: "Jakarta",
  remote: true,
  salaryRange: "$120k-$160k",
  jobType: "FULL_TIME" as const,
  experienceLevel: "SENIOR" as const,
  skillsRequired: ["TypeScript", "Soroban"],
  candidateStakeRequired: true,
  candidateStakeAmount: 25,
};

test("jobs repository creates and lists recruiter jobs", async () => {
  const repository = createInMemoryJobsRepository();

  const job = await repository.createJob("recruiter-1", jobInput);

  assert.equal(job.recruiterUserId, "recruiter-1");
  assert.equal(job.title, jobInput.title);
  assert.equal(job.status, "DRAFT");
  assert.deepEqual(await repository.listJobsByRecruiter("recruiter-1"), [job]);
  assert.deepEqual(await repository.listActiveJobs(), []);
});

test("jobs repository updates status and exposes active jobs", async () => {
  const repository = createInMemoryJobsRepository();
  const job = await repository.createJob("recruiter-1", jobInput);

  const active = await repository.updateJobStatus(job.id, "ACTIVE");

  assert.equal(active.status, "ACTIVE");
  assert.deepEqual(await repository.getJob(job.id), active);
  assert.deepEqual(await repository.listActiveJobs(), [active]);
});

test("jobs repository rejects updates for missing jobs", async () => {
  const repository = createInMemoryJobsRepository();

  await assert.rejects(
    repository.updateJobStatus("missing", "ACTIVE"),
    JobsRepositoryError,
  );
});
