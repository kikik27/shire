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

test("job matching job returns data from the local source", async () => {
  const result = await runJobMatchingJob();

  assert.equal(result.routing.capability, "job-rerank");
  assert.deepEqual(result.usage, []);
});

test("talent matching job returns data from the local source", async () => {
  const result = await runTalentMatchingJob();

  assert.equal(result.routing.capability, "talent-rerank");
  assert.deepEqual(result.usage, []);
});

test("dispute summary job returns data from the local source", async () => {
  const result = await runDisputeSummaryJob();

  assert.equal(result.routing.capability, "dispute-summary");
  assert.deepEqual(result.usage, []);
});
