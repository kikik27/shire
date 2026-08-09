import assert from "node:assert/strict";
import test from "node:test";

import {
  getActiveRoleState,
  onboardingChoiceDestination,
  postOnboardingDestination,
  roleDestination,
  switchableRoles,
} from "../lib/role-client";

const candidateProfile = {
  displayName: "Candidate One",
  bio: "Builds web3 products.",
  skills: ["TypeScript"],
  roleTargets: ["Frontend Engineer"],
  experienceLevel: "SENIOR",
  languages: ["English"],
  visibility: "PUBLIC",
};

const recruiterProfile = {
  companyName: "Shire Labs",
  companyDescription: "Hiring infrastructure.",
  verificationStatus: "UNVERIFIED",
  trustLevel: 30,
  completedHires: 0,
  disputeCount: 0,
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("candidate profile activates only candidate", async () => {
  const fetcher: typeof fetch = async (input) => {
    if (String(input).endsWith("/candidate")) {
      return jsonResponse(200, { profile: candidateProfile });
    }
    // Not-onboarded recruiter is a normal state: 200 with a null profile.
    return jsonResponse(200, { profile: null });
  };

  assert.deepEqual(await getActiveRoleState("token", fetcher), {
    candidate: true,
    recruiter: false,
  });
});

test("both profiles activate candidate and recruiter", async () => {
  const fetcher: typeof fetch = async (input) => {
    if (String(input).endsWith("/candidate")) {
      return jsonResponse(200, { profile: candidateProfile });
    }
    return jsonResponse(200, { profile: recruiterProfile });
  };

  assert.deepEqual(await getActiveRoleState("token", fetcher), {
    candidate: true,
    recruiter: true,
  });
});

test("missing recruiter profile routes to recruiter onboarding", () => {
  assert.equal(
    roleDestination("recruiter", { candidate: true, recruiter: false }),
    "/onboarding/recruiter",
  );
});

test("admin is not exposed as a user-switchable role", () => {
  assert.deepEqual(switchableRoles, ["candidate", "recruiter"]);
});

test("both onboarding choice continues candidate setup into recruiter setup", () => {
  assert.equal(onboardingChoiceDestination("both"), "/onboarding/candidate?next=%2Fonboarding%2Frecruiter");
});

test("single role onboarding choices go directly to that setup", () => {
  assert.equal(onboardingChoiceDestination("candidate"), "/onboarding/candidate");
  assert.equal(onboardingChoiceDestination("recruiter"), "/onboarding/recruiter");
});

test("post onboarding destination prefers active role homes over onboarding", () => {
  assert.equal(
    postOnboardingDestination({ candidate: true, recruiter: false }),
    "/candidate",
  );
  assert.equal(
    postOnboardingDestination({ candidate: false, recruiter: true }),
    "/recruiter",
  );
  assert.equal(
    postOnboardingDestination({ candidate: true, recruiter: true }),
    "/candidate",
  );
  assert.equal(
    postOnboardingDestination({ candidate: false, recruiter: false }),
    null,
  );
});
