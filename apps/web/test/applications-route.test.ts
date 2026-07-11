import assert from "node:assert/strict";
import test from "node:test";

import { createInMemoryApplicationsRepository } from "../lib/server/applications-repository";
import { createApplicationsRouteHandlers } from "../lib/server/applications-route";
import { createInMemoryJobsRepository } from "../lib/server/jobs-repository";
import { createInMemoryProfileRepository } from "../lib/server/profile-repository";

function authenticated(privyUserId = "did:privy:candidate") {
  return async () => ({ mode: "privy", privyUserId }) as const;
}

function jsonRequest(method: string, url: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const jobPayload = {
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

const candidateProfile = {
  displayName: "Alex Candidate",
  bio: "Experienced protocol engineer building production systems.",
  skills: ["TypeScript", "Soroban"],
  roleTargets: ["Protocol Engineer"],
  experienceLevel: "SENIOR" as const,
  githubUrl: "https://github.com/alex",
  location: "Jakarta",
  languages: ["English", "Indonesian"],
  visibility: "PUBLIC" as const,
};

test("candidate applications POST applies as the authenticated internal user", async () => {
  const profiles = createInMemoryProfileRepository();
  const jobs = createInMemoryJobsRepository();
  const recruiter = await profiles.resolveUser("did:privy:recruiter");
  const job = await jobs.createJob(recruiter.id, jobPayload);
  await jobs.updateJobStatus(job.id, "ACTIVE");
  const applications = createInMemoryApplicationsRepository(jobs);
  const handlers = createApplicationsRouteHandlers({
    resolveAuthenticatedUser: authenticated(),
    profileRepository: profiles,
    applicationsRepository: applications,
  });

  const response = await handlers.POST(
    jsonRequest("POST", `http://localhost/api/candidate/applications/${job.id}`, {
      message: "I have shipped production TypeScript systems.",
      stakeAmount: 10,
    }),
    { params: Promise.resolve({ jobId: job.id }) },
  );

  assert.equal(response.status, 201);
  const candidate = await profiles.resolveUser("did:privy:candidate");
  assert.deepEqual(await response.json(), {
    application: JSON.parse(
      JSON.stringify((await applications.listApplicationsByCandidate(candidate.id))[0]),
    ),
  });
});

test("candidate applications GET lists only the authenticated candidate", async () => {
  const profiles = createInMemoryProfileRepository();
  const jobs = createInMemoryJobsRepository();
  const recruiter = await profiles.resolveUser("did:privy:recruiter");
  const job = await jobs.createJob(recruiter.id, jobPayload);
  await jobs.updateJobStatus(job.id, "ACTIVE");
  const applications = createInMemoryApplicationsRepository(jobs);
  const candidate = await profiles.resolveUser("did:privy:candidate");
  const other = await profiles.resolveUser("did:privy:other");
  const ownApplication = await applications.applyToJob(candidate.id, job.id, {
    message: "Own application.",
  });
  await applications.applyToJob(other.id, job.id, {
    message: "Other application.",
  });
  const handlers = createApplicationsRouteHandlers({
    resolveAuthenticatedUser: authenticated(),
    profileRepository: profiles,
    applicationsRepository: applications,
  });

  const response = await handlers.GET(
    jsonRequest("GET", "http://localhost/api/candidate/applications"),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    applications: JSON.parse(JSON.stringify([ownApplication])),
  });
});

test("recruiter job applications GET requires job ownership", async () => {
  const profiles = createInMemoryProfileRepository();
  const jobs = createInMemoryJobsRepository();
  const recruiter = await profiles.resolveUser("did:privy:recruiter");
  const otherRecruiter = await profiles.resolveUser("did:privy:other-recruiter");
  const candidate = await profiles.resolveUser("did:privy:candidate");
  const ownedJob = await jobs.createJob(recruiter.id, jobPayload);
  const otherJob = await jobs.createJob(otherRecruiter.id, jobPayload);
  await jobs.updateJobStatus(ownedJob.id, "ACTIVE");
  await jobs.updateJobStatus(otherJob.id, "ACTIVE");
  await profiles.upsertProfile(candidate.id, "candidate", candidateProfile);
  const applications = createInMemoryApplicationsRepository(jobs, profiles);
  const application = await applications.applyToJob(candidate.id, ownedJob.id, {
    message: "Candidate application.",
  });
  const handlers = createApplicationsRouteHandlers({
    resolveAuthenticatedUser: authenticated("did:privy:recruiter"),
    profileRepository: profiles,
    jobsRepository: jobs,
    applicationsRepository: applications,
  });

  const response = await handlers.GET_JOB(
    jsonRequest("GET", `http://localhost/api/recruiter/jobs/${ownedJob.id}/applications`),
    { params: Promise.resolve({ id: ownedJob.id }) },
  );
  const forbidden = await handlers.GET_JOB(
    jsonRequest("GET", `http://localhost/api/recruiter/jobs/${otherJob.id}/applications`),
    { params: Promise.resolve({ id: otherJob.id }) },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    applications: JSON.parse(
      JSON.stringify([
        {
          ...application,
          candidate: {
            displayName: "Alex Candidate",
            headline: "Protocol Engineer",
            skills: ["TypeScript", "Soroban"],
            location: "Jakarta",
            githubUrl: "https://github.com/alex",
          },
        },
      ]),
    ),
  });
  assert.equal(forbidden.status, 403);
});

test("recruiter applications GET returns candidate summaries only for owned jobs", async () => {
  const profiles = createInMemoryProfileRepository();
  const jobs = createInMemoryJobsRepository();
  const recruiter = await profiles.resolveUser("did:privy:recruiter");
  const otherRecruiter = await profiles.resolveUser("did:privy:other-recruiter");
  const candidate = await profiles.resolveUser("did:privy:candidate");
  const ownedJob = await jobs.createJob(recruiter.id, jobPayload);
  const otherJob = await jobs.createJob(otherRecruiter.id, jobPayload);
  await jobs.updateJobStatus(ownedJob.id, "ACTIVE");
  await jobs.updateJobStatus(otherJob.id, "ACTIVE");
  await profiles.upsertProfile(candidate.id, "candidate", candidateProfile);
  const applications = createInMemoryApplicationsRepository(jobs, profiles);
  const ownedApplication = await applications.applyToJob(
    candidate.id,
    ownedJob.id,
    { message: "Owned application." },
  );
  await applications.applyToJob(candidate.id, otherJob.id, {
    message: "Foreign application.",
  });
  const handlers = createApplicationsRouteHandlers({
    resolveAuthenticatedUser: authenticated("did:privy:recruiter"),
    profileRepository: profiles,
    jobsRepository: jobs,
    applicationsRepository: applications,
  });

  const response = await handlers.GET_RECRUITER(
    jsonRequest("GET", "http://localhost/api/recruiter/applications"),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.applications.length, 1);
  assert.equal(body.applications[0].id, ownedApplication.id);
  assert.deepEqual(body.applications[0].candidate, {
    displayName: "Alex Candidate",
    headline: "Protocol Engineer",
    skills: ["TypeScript", "Soroban"],
    location: "Jakarta",
    githubUrl: "https://github.com/alex",
  });
  assert.equal("bio" in body.applications[0].candidate, false);
  assert.equal("salaryExpectation" in body.applications[0].candidate, false);
});
