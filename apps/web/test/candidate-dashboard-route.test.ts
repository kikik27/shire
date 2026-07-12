import assert from "node:assert/strict";
import test from "node:test";

import { createCandidateDashboardRouteHandlers } from "../lib/server/candidate-dashboard-route";
import { createInMemoryProfileRepository } from "../lib/server/profile-repository";

test("candidate dashboard returns persisted counts and top recommendations", async () => {
  const profiles = createInMemoryProfileRepository();
  const candidate = await profiles.resolveUser("did:privy:candidate");
  const dashboard = {
    activeApplicationCount: 1,
    availableJobCount: 4,
    newRecommendationCount: 2,
    applications: [
      {
        id: "application-1",
        jobId: "job-1",
        candidateUserId: candidate.id,
        status: "APPLIED" as const,
        message: "I would like to contribute.",
        matchScore: 83,
        riskScore: 10,
        createdAt: 1_750_000_000_000,
        updatedAt: 1_750_000_000_000,
        job: {
          title: "Protocol Engineer",
          companyName: "Shire Labs",
        },
      },
    ],
    recommendations: [
      {
        id: "recommendation-1",
        type: "JOB_TO_CANDIDATE" as const,
        candidateUserId: candidate.id,
        jobId: "job-1",
        matchScore: 83,
        confidence: 0.82,
        reasons: ["Required skills match"],
        missingRequirements: [],
        riskFlags: [],
        recommendedAction: "SUGGEST_APPLY",
        status: "NEW" as const,
        createdAt: 1_750_000_000_000,
        updatedAt: 1_750_000_000_000,
        job: {
          title: "Protocol Engineer",
          companyName: "Shire Labs",
          location: "Remote",
          remote: true,
          experienceLevel: "SENIOR",
          skillsRequired: ["TypeScript"],
        },
      },
    ],
  };
  let requestedCandidateUserId: string | undefined;
  const handlers = createCandidateDashboardRouteHandlers({
    resolveAuthenticatedUser: async () =>
      ({ mode: "stellar", privyUserId: "did:privy:candidate", walletAddress: "GTESTAUTH" }) as const,
    profileRepository: profiles,
    candidateDashboardRepository: {
      async getCandidateDashboard(candidateUserId) {
        requestedCandidateUserId = candidateUserId;
        return dashboard;
      },
    },
  });

  const response = await handlers.GET(
    new Request("http://localhost/api/candidate/dashboard"),
  );

  assert.equal(response.status, 200);
  assert.equal(requestedCandidateUserId, candidate.id);
  assert.deepEqual(await response.json(), dashboard);
});
