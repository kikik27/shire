import assert from "node:assert/strict";
import test from "node:test";

import { createInMemoryProfileRepository } from "../lib/server/profile-repository";
import {
  createCandidateRecommendationsRouteHandlers,
  createRecruiterRecommendationsRouteHandlers,
} from "../lib/server/recommendations-route";
import { createInMemoryRecommendationsRepository } from "../lib/server/recommendations-repository";

function authenticated(privyUserId = "did:privy:candidate") {
  return async () => ({ mode: "privy", privyUserId }) as const;
}

function getRequest(url: string) {
  return new Request(url, { method: "GET" });
}

function seedRecommendation(
  repository: ReturnType<typeof createInMemoryRecommendationsRepository>,
  overrides: Partial<{
    id: string;
    type: "JOB_TO_CANDIDATE" | "TALENT_TO_COMPANY";
    candidateUserId: string;
    recruiterUserId: string;
    jobId: string;
    matchScore: number;
    recommendedAction: string;
  }>,
) {
  const now = Date.now();
  repository.seed({
    id: overrides.id ?? crypto.randomUUID(),
    type: overrides.type ?? "JOB_TO_CANDIDATE",
    candidateUserId: overrides.candidateUserId ?? "candidate-1",
    recruiterUserId: overrides.recruiterUserId,
    jobId: overrides.jobId,
    matchScore: overrides.matchScore ?? 80,
    confidence: 0.85,
    reasons: ["skill overlap"],
    missingRequirements: [],
    riskFlags: [],
    recommendedAction: overrides.recommendedAction ?? "SUGGEST_APPLY",
    status: "NEW",
    createdAt: now,
    updatedAt: now,
  });
}

test("candidate recommendations GET returns only the candidate's job recommendations", async () => {
  const profiles = createInMemoryProfileRepository();
  const candidate = await profiles.resolveUser("did:privy:candidate");
  const other = await profiles.resolveUser("did:privy:other");
  const recommendations = createInMemoryRecommendationsRepository();
  seedRecommendation(recommendations, {
    candidateUserId: candidate.id,
    matchScore: 88,
    recommendedAction: "SUGGEST_APPLY",
  });
  seedRecommendation(recommendations, {
    candidateUserId: other.id,
    matchScore: 72,
    recommendedAction: "SAVE_ONLY",
  });

  const handlers = createCandidateRecommendationsRouteHandlers({
    resolveAuthenticatedUser: authenticated(),
    profileRepository: profiles,
    recommendationsRepository: recommendations,
  });

  const response = await handlers.GET(
    getRequest("http://localhost/api/candidate/recommendations"),
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.recommendations.length, 1);
  assert.equal(body.recommendations[0].candidateUserId, candidate.id);
  assert.equal(body.recommendations[0].matchScore, 88);
});

test("candidate recommendations GET orders by match score descending", async () => {
  const profiles = createInMemoryProfileRepository();
  const candidate = await profiles.resolveUser("did:privy:candidate");
  const recommendations = createInMemoryRecommendationsRepository();
  seedRecommendation(recommendations, {
    candidateUserId: candidate.id,
    matchScore: 71,
  });
  seedRecommendation(recommendations, {
    candidateUserId: candidate.id,
    matchScore: 95,
  });
  seedRecommendation(recommendations, {
    candidateUserId: candidate.id,
    matchScore: 83,
  });

  const handlers = createCandidateRecommendationsRouteHandlers({
    resolveAuthenticatedUser: authenticated(),
    profileRepository: profiles,
    recommendationsRepository: recommendations,
  });

  const response = await handlers.GET(
    getRequest("http://localhost/api/candidate/recommendations"),
  );
  const body = await response.json();

  assert.deepEqual(
    body.recommendations.map((r: { matchScore: number }) => r.matchScore),
    [95, 83, 71],
  );
});

test("recruiter recommendations GET returns only the recruiter's talent recommendations", async () => {
  const profiles = createInMemoryProfileRepository();
  const recruiter = await profiles.resolveUser("did:privy:recruiter");
  const otherRecruiter = await profiles.resolveUser("did:privy:other-recruiter");
  const recommendations = createInMemoryRecommendationsRepository();
  seedRecommendation(recommendations, {
    type: "TALENT_TO_COMPANY",
    recruiterUserId: recruiter.id,
    matchScore: 90,
    recommendedAction: "SUGGEST_INVITE",
  });
  seedRecommendation(recommendations, {
    type: "TALENT_TO_COMPANY",
    recruiterUserId: otherRecruiter.id,
    matchScore: 75,
    recommendedAction: "SAVE_ONLY",
  });

  const handlers = createRecruiterRecommendationsRouteHandlers({
    resolveAuthenticatedUser: authenticated("did:privy:recruiter"),
    profileRepository: profiles,
    recommendationsRepository: recommendations,
  });

  const response = await handlers.GET(
    getRequest("http://localhost/api/recruiter/recommendations"),
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.recommendations.length, 1);
  assert.equal(body.recommendations[0].recruiterUserId, recruiter.id);
  assert.equal(body.recommendations[0].recommendedAction, "SUGGEST_INVITE");
});
