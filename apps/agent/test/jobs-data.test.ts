import assert from "node:assert/strict";
import test from "node:test";

import {
  candidates,
  companies,
  disputes,
  jobRunnerData,
  jobs,
} from "../src/runtime/data/runtime-data";
import { runCvParseJob } from "../src/jobs/run-cv-parse";
import { runDisputeSummaryJob } from "../src/jobs/run-dispute-summary";
import { runJobMatchingJob } from "../src/jobs/run-job-matching";
import { runTalentMatchingJob } from "../src/jobs/run-talent-matching";

test("runtime data source exposes typed job, candidate, company, and dispute records", () => {
  assert.ok(candidates.length >= 2);
  assert.ok(jobs.length >= 2);
  assert.ok(companies.length >= 2);
  assert.ok(disputes.length >= 2);

  assert.deepEqual(Object.keys(jobRunnerData).sort(), [
    "cv-parse",
    "dispute-summary",
    "job-matching",
    "talent-matching",
  ]);

  assert.equal(jobRunnerData["cv-parse"].candidate.id, candidates[0].id);
  assert.equal(jobRunnerData["job-matching"].candidate.id, candidates[1].id);
  assert.equal(jobRunnerData["job-matching"].job.id, jobs[0].id);
  assert.equal(jobRunnerData["talent-matching"].company.id, companies[1].id);
  assert.equal(jobRunnerData["talent-matching"].talent.id, candidates[0].id);
  assert.equal(jobRunnerData["dispute-summary"].dispute.id, disputes[1].id);
});

test("cv parse job returns data from the local source", async () => {
  const result = await runCvParseJob();

  assert.equal(result.job, "cv-parse");
  assert.equal(result.agent, "cv-profile-agent");
  assert.equal(result.workflow, "parse-cv-workflow");
  assert.deepEqual(result.data, jobRunnerData["cv-parse"]);
  assert.equal(result.routing.capability, "cv-normalization");
  assert.deepEqual(result.usage, []);
});

test("job matching CLI requires a candidate id", async () => {
  await assert.rejects(runJobMatchingJob([]), /candidate id is required/i);
});

test("job matching CLI routes the candidate through canonical matching", async () => {
  const calls: unknown[] = [];
  const result = await runJobMatchingJob(["candidate-123"], {
    createJobId: () => "manual-job-matching",
    process: async (payload, context) => {
      calls.push({ payload, context });
      return {
        status: "ready",
        saved: 1,
        evaluated: 2,
        strong: 1,
        llmInvoked: true,
        durationMs: 12,
      };
    },
  });

  assert.equal(calls.length, 1);
  const call = calls[0] as {
    payload: unknown;
    context: { jobId: string; attempt: number; signal: AbortSignal };
  };
  assert.deepEqual(call.payload, { candidateId: "candidate-123" });
  assert.equal(call.context.jobId, "manual-job-matching");
  assert.equal(call.context.attempt, 1);
  assert.ok(call.context.signal instanceof AbortSignal);
  assert.equal(result.job, "job-matching");
  assert.equal(result.routing.capability, "job-rerank");
  assert.equal(result.status, "ready");
  assert.equal(result.saved, 1);
  assert.equal("data" in result, false);
});

test("talent matching CLI requires a job id", async () => {
  await assert.rejects(runTalentMatchingJob([]), /job id is required/i);
});

test("talent matching CLI routes the job through canonical matching", async () => {
  const calls: unknown[] = [];
  const result = await runTalentMatchingJob(["job-123"], {
    createJobId: () => "manual-talent-matching",
    process: async (payload, context) => {
      calls.push({ payload, context });
      return {
        status: "ready",
        saved: 1,
        evaluated: 3,
        strong: 1,
        llmInvoked: true,
        durationMs: 15,
      };
    },
  });

  assert.equal(calls.length, 1);
  const call = calls[0] as {
    payload: unknown;
    context: { jobId: string; attempt: number; signal: AbortSignal };
  };
  assert.deepEqual(call.payload, { jobId: "job-123" });
  assert.equal(call.context.jobId, "manual-talent-matching");
  assert.equal(call.context.attempt, 1);
  assert.ok(call.context.signal instanceof AbortSignal);
  assert.equal(result.job, "talent-matching");
  assert.equal(result.routing.capability, "talent-rerank");
  assert.equal(result.status, "ready");
  assert.equal(result.saved, 1);
  assert.equal("data" in result, false);
});

test("dispute summary job returns data from the local source", async () => {
  const result = await runDisputeSummaryJob();

  assert.equal(result.routing.capability, "dispute-summary");
  assert.deepEqual(result.usage, []);
});
