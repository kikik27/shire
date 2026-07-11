import assert from "node:assert/strict";
import test from "node:test";

import {
  AuthenticatedUserConfigurationError,
  AuthenticatedUserError,
} from "../lib/server/authenticated-user";
import { DatabaseConfigurationError } from "../lib/server/db";
import {
  createInMemoryProfileRepository,
  ProfileRepositoryError,
  type ProfileRepository,
} from "../lib/server/profile-repository";
import { createProfileRouteHandlers } from "../lib/server/profile-route";

const candidateProfile = {
  displayName: "Candidate One",
  bio: "Experienced protocol engineer building secure web3 products.",
  skills: ["TypeScript", "Soroban"],
  roleTargets: ["Protocol Engineer"],
  experienceLevel: "SENIOR",
  portfolioUrl: "",
  githubUrl: "https://github.com/candidate",
  linkedinUrl: "",
  xUrl: "",
  location: "Jakarta",
  timezone: "Asia/Jakarta",
  languages: ["English", "Indonesian"],
  salaryExpectation: "$120k",
  visibility: "PUBLIC",
} as const;

const recruiterProfile = {
  companyName: "Shire Labs",
  companyWebsite: "",
  companyDescription: "Building trusted hiring infrastructure for web3 teams.",
  contactEmail: "",
  location: "",
} as const;

function authenticated(
  privyUserId = "did:privy:user-1",
  walletAddress?: string,
) {
  return async () =>
    ({ mode: "privy", privyUserId, walletAddress }) as const;
}

function jsonRequest(method: string, body?: unknown) {
  return new Request("http://localhost/api/profiles/candidate", {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

test("candidate PUT persists a validated profile for the verified user", async () => {
  const repository = createInMemoryProfileRepository();
  const handlers = createProfileRouteHandlers("candidate", {
    resolveAuthenticatedUser: authenticated(),
    repository,
  });

  const response = await handlers.PUT(jsonRequest("PUT", candidateProfile));

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.profile, {
    displayName: candidateProfile.displayName,
    bio: candidateProfile.bio,
    skills: candidateProfile.skills,
    roleTargets: candidateProfile.roleTargets,
    experienceLevel: candidateProfile.experienceLevel,
    githubUrl: candidateProfile.githubUrl,
    location: candidateProfile.location,
    timezone: candidateProfile.timezone,
    languages: candidateProfile.languages,
    salaryExpectation: candidateProfile.salaryExpectation,
    visibility: candidateProfile.visibility,
  });
  const user = await repository.resolveUser("did:privy:user-1");
  assert.deepEqual(
    await repository.getProfile(user.id, "candidate"),
    {
      ...candidateProfile,
      portfolioUrl: undefined,
      linkedinUrl: undefined,
      xUrl: undefined,
    },
  );
});

test("candidate PUT persists the verified wallet address on the user", async () => {
  const repository = createInMemoryProfileRepository();
  const handlers = createProfileRouteHandlers("candidate", {
    resolveAuthenticatedUser: authenticated(
      "did:privy:user-1",
      "0x1234567890abcdef1234567890abcdef12345678",
    ),
    repository,
  });

  const response = await handlers.PUT(jsonRequest("PUT", candidateProfile));

  assert.equal(response.status, 200);
  const user = await repository.resolveUser("did:privy:user-1");
  assert.equal(user.walletAddress, "0x1234567890abcdef1234567890abcdef12345678");
});

test("recruiter PUT activates a second role for the same user", async () => {
  const repository = createInMemoryProfileRepository();
  const auth = authenticated();
  const candidateHandlers = createProfileRouteHandlers("candidate", {
    resolveAuthenticatedUser: auth,
    repository,
  });
  const recruiterHandlers = createProfileRouteHandlers("recruiter", {
    resolveAuthenticatedUser: auth,
    repository,
  });

  await candidateHandlers.PUT(jsonRequest("PUT", candidateProfile));
  const response = await recruiterHandlers.PUT(
    jsonRequest("PUT", recruiterProfile),
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  const user = await repository.resolveUser("did:privy:user-1");
  assert.deepEqual(await repository.listActiveRoles(user.id), [
    "candidate",
    "recruiter",
  ]);
  assert.deepEqual(body.profile, {
    companyName: recruiterProfile.companyName,
    companyDescription: recruiterProfile.companyDescription,
    verificationStatus: "UNVERIFIED",
    trustLevel: 30,
    completedHires: 0,
    disputeCount: 0,
  });
  assert.deepEqual(await repository.getProfile(user.id, "recruiter"), {
    ...recruiterProfile,
    companyWebsite: undefined,
    contactEmail: undefined,
    location: undefined,
    verificationStatus: "UNVERIFIED",
    trustLevel: 30,
    completedHires: 0,
    disputeCount: 0,
  });
});

test("recruiter repeated PUT preserves validated server-owned metrics", async () => {
  const repository = createInMemoryProfileRepository();
  const user = await repository.resolveUser("did:privy:user-1");
  await repository.upsertProfile(user.id, "recruiter", {
    ...recruiterProfile,
    verificationStatus: "VERIFIED",
    trustLevel: 92,
    completedHires: 14,
    disputeCount: 1,
  });
  const handlers = createProfileRouteHandlers("recruiter", {
    resolveAuthenticatedUser: authenticated(),
    repository,
  });

  const response = await handlers.PUT(
    jsonRequest("PUT", {
      ...recruiterProfile,
      companyDescription: "Updated company description for web3 hiring.",
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).profile, {
    companyName: recruiterProfile.companyName,
    companyDescription: "Updated company description for web3 hiring.",
    verificationStatus: "VERIFIED",
    trustLevel: 92,
    completedHires: 14,
    disputeCount: 1,
  });
});

test("recruiter PUT rejects client-supplied server-owned metrics", async () => {
  const handlers = createProfileRouteHandlers("recruiter", {
    resolveAuthenticatedUser: authenticated(),
    repository: createInMemoryProfileRepository(),
  });

  const response = await handlers.PUT(
    jsonRequest("PUT", {
      ...recruiterProfile,
      verificationStatus: "VERIFIED",
      trustLevel: 100,
      completedHires: 999,
      disputeCount: 0,
    }),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "invalid-profile" });
});

test("PUT atomically resolves the Privy user and saves the role profile", async () => {
  const base = createInMemoryProfileRepository();
  let atomicSaveCalls = 0;
  const repository: ProfileRepository = {
    ...base,
    async saveProfileForPrivyUser(privyUserId, role, profile) {
      atomicSaveCalls += 1;
      return base.saveProfileForPrivyUser(privyUserId, role, profile);
    },
    async resolveUser() {
      throw new Error("PUT must use the atomic repository operation");
    },
    async upsertProfile() {
      throw new Error("PUT must use the atomic repository operation");
    },
  };
  const handlers = createProfileRouteHandlers("candidate", {
    resolveAuthenticatedUser: authenticated(),
    repository,
  });

  const response = await handlers.PUT(jsonRequest("PUT", candidateProfile));

  assert.equal(response.status, 200);
  assert.equal(atomicSaveCalls, 1);
});

test("GET returns 404 when the requested role has no profile", async () => {
  const repository = createInMemoryProfileRepository();
  await repository.resolveUser("did:privy:user-1");
  const handlers = createProfileRouteHandlers("candidate", {
    resolveAuthenticatedUser: authenticated(),
    repository,
  });

  const response = await handlers.GET(jsonRequest("GET"));

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "profile-not-found" });
});

test("GET validates stored profile payloads before returning them", async () => {
  const repository = createInMemoryProfileRepository();
  const user = await repository.resolveUser("did:privy:user-1");
  await repository.upsertProfile(user.id, "candidate", {
    displayName: "invalid stored payload",
  });
  const handlers = createProfileRouteHandlers("candidate", {
    resolveAuthenticatedUser: authenticated(),
    repository,
  });

  const response = await handlers.GET(jsonRequest("GET"));

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "database-error" });
});

test("candidate GET does not repair missing persisted defaults", async () => {
  const repository = createInMemoryProfileRepository();
  const user = await repository.resolveUser("did:privy:user-1");
  const corruptProfile = { ...candidateProfile, languages: undefined };
  await repository.upsertProfile(user.id, "candidate", corruptProfile);
  const handlers = createProfileRouteHandlers("candidate", {
    resolveAuthenticatedUser: authenticated(),
    repository,
  });

  const response = await handlers.GET(jsonRequest("GET"));

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "database-error" });
});

test("recruiter GET rejects corrupt persisted metrics", async () => {
  const repository = createInMemoryProfileRepository();
  const user = await repository.resolveUser("did:privy:user-1");
  await repository.upsertProfile(user.id, "recruiter", {
    ...recruiterProfile,
    verificationStatus: "VERIFIED",
    trustLevel: "high",
    completedHires: 14,
    disputeCount: 1,
  });
  const handlers = createProfileRouteHandlers("recruiter", {
    resolveAuthenticatedUser: authenticated(),
    repository,
  });

  const response = await handlers.GET(jsonRequest("GET"));

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "database-error" });
});

test("recruiter GET preserves validated server-owned metrics", async () => {
  const repository = createInMemoryProfileRepository();
  const user = await repository.resolveUser("did:privy:user-1");
  await repository.upsertProfile(user.id, "recruiter", {
    companyName: "Shire Labs",
    companyWebsite: "https://shire.example",
    companyDescription: "Building trusted hiring infrastructure for web3 teams.",
    contactEmail: "hiring@shire.example",
    location: "Jakarta",
    verificationStatus: "VERIFIED",
    trustLevel: 92,
    completedHires: 14,
    disputeCount: 1,
  });
  const handlers = createProfileRouteHandlers("recruiter", {
    resolveAuthenticatedUser: authenticated(),
    repository,
  });

  const response = await handlers.GET(jsonRequest("GET"));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    profile: {
      companyName: "Shire Labs",
      companyWebsite: "https://shire.example",
      companyDescription:
        "Building trusted hiring infrastructure for web3 teams.",
      contactEmail: "hiring@shire.example",
      location: "Jakarta",
      verificationStatus: "VERIFIED",
      trustLevel: 92,
      completedHires: 14,
      disputeCount: 1,
    },
  });
});

test("PUT rejects an invalid profile with 400", async () => {
  const handlers = createProfileRouteHandlers("candidate", {
    resolveAuthenticatedUser: authenticated(),
    repository: createInMemoryProfileRepository(),
  });

  const response = await handlers.PUT(
    jsonRequest("PUT", { displayName: "x" }),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "invalid-profile" });
});

test("missing or invalid Privy tokens return 401", async () => {
  const repository = createInMemoryProfileRepository();
  const failures = [
    new AuthenticatedUserError("Authentication is required."),
    new AuthenticatedUserError("Authentication token is invalid."),
  ];

  for (const failure of failures) {
    const handlers = createProfileRouteHandlers("candidate", {
      resolveAuthenticatedUser: async () => {
        throw failure;
      },
      repository,
    });
    const response = await handlers.GET(jsonRequest("GET"));
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "unauthorized" });
  }
});

test("authentication configuration failures return a stable 500", async () => {
  const handlers = createProfileRouteHandlers("candidate", {
    resolveAuthenticatedUser: async () => {
      throw new AuthenticatedUserConfigurationError("missing");
    },
    repository: createInMemoryProfileRepository(),
  });

  const response = await handlers.GET(jsonRequest("GET"));

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    error: "authentication-configuration-error",
  });
});

test("repository failures return a stable 500", async () => {
  const base = createInMemoryProfileRepository();
  const repository: ProfileRepository = {
    ...base,
    async resolveUser() {
      throw new ProfileRepositoryError("database unavailable");
    },
  };
  const handlers = createProfileRouteHandlers("candidate", {
    resolveAuthenticatedUser: authenticated(),
    repository,
  });

  const response = await handlers.GET(jsonRequest("GET"));

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "database-error" });
});

test("missing database configuration returns a stable 500", async () => {
  const base = createInMemoryProfileRepository();
  const repository: ProfileRepository = {
    ...base,
    async resolveUser() {
      throw new DatabaseConfigurationError();
    },
  };
  const handlers = createProfileRouteHandlers("candidate", {
    resolveAuthenticatedUser: authenticated(),
    repository,
  });

  const response = await handlers.GET(jsonRequest("GET"));

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    error: "missing-database-configuration",
  });
});
