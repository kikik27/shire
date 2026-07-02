import assert from "node:assert/strict";
import test from "node:test";

import { createRecruiterDashboardRouteHandlers } from "../lib/server/recruiter-dashboard-route";
import { createInMemoryProfileRepository } from "../lib/server/profile-repository";

test("recruiter dashboard aggregates only owned jobs", async () => {
  const profiles = createInMemoryProfileRepository();
  const recruiter = await profiles.resolveUser("did:privy:recruiter");
  const dashboard = {
    kpis: {
      activeJobs: 1,
      applicants: 2,
      interviews: 1,
      offers: 0,
    },
    catalog: [
      {
        id: "job-owned",
        recruiterUserId: recruiter.id,
        title: "Protocol Engineer",
        companyName: "Shire Labs",
        experienceLevel: "SENIOR" as const,
        status: "ACTIVE" as const,
        stakeAmount: 100,
        stakeToken: "cUSD" as const,
        createdAt: 1_750_000_000_000,
        applicantCount: 2,
      },
    ],
    activity: [{ date: "2026-06-23", applications: 2 }],
    matchDistribution: [{ bucket: "strong", count: 1 }],
    pipeline: [{ status: "INTERVIEW" as const, count: 1 }],
    recentApplicants: [],
    talentRegions: [{ region: "Jakarta", count: 2 }],
  };
  let requestedRecruiterUserId: string | undefined;
  const handlers = createRecruiterDashboardRouteHandlers({
    resolveAuthenticatedUser: async () =>
      ({ mode: "privy", privyUserId: "did:privy:recruiter" }) as const,
    profileRepository: profiles,
    recruiterDashboardRepository: {
      async getRecruiterDashboard(recruiterUserId) {
        requestedRecruiterUserId = recruiterUserId;
        return dashboard;
      },
    },
  });

  const response = await handlers.GET(
    new Request("http://localhost/api/recruiter/dashboard"),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(requestedRecruiterUserId, recruiter.id);
  assert.deepEqual(body.kpis, {
    activeJobs: 1,
    applicants: 2,
    interviews: 1,
    offers: 0,
  });
  assert.equal(
    body.catalog.every(
      (row: { recruiterUserId: string }) =>
        row.recruiterUserId === recruiter.id,
    ),
    true,
  );
});
