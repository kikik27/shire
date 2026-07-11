import assert from "node:assert/strict";
import test from "node:test";

import {
  getProfile,
  InvalidProfileResponseError,
  ProfileForbiddenError,
  ProfileNotFoundError,
  ProfileServerError,
  ProfileUnauthorizedError,
  saveProfile,
} from "../lib/profile-client";

const candidateProfile = {
  displayName: "Candidate One",
  bio: "Experienced protocol engineer building secure web3 products.",
  skills: ["TypeScript", "Soroban"],
  roleTargets: ["Protocol Engineer"],
  experienceLevel: "SENIOR",
  languages: ["English", "Indonesian"],
  visibility: "PUBLIC",
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("loads a role profile with a Privy bearer token", async () => {
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    calls.push({ input, init });
    return jsonResponse(200, { profile: candidateProfile });
  };

  const profile = await getProfile("candidate", "privy-token", fetcher);

  assert.deepEqual(profile, candidateProfile);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.input, "/api/profiles/candidate");
  assert.equal(calls[0]?.init?.method, "GET");
  assert.deepEqual(calls[0]?.init?.headers, {
    authorization: "Bearer privy-token",
  });
});

test("saves a role profile with a Privy bearer token", async () => {
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    calls.push({ input, init });
    return jsonResponse(200, { profile: candidateProfile });
  };

  const profile = await saveProfile(
    "candidate",
    candidateProfile,
    "privy-token",
    fetcher,
  );

  assert.deepEqual(profile, candidateProfile);
  assert.equal(calls[0]?.input, "/api/profiles/candidate");
  assert.equal(calls[0]?.init?.method, "PUT");
  assert.deepEqual(calls[0]?.init?.headers, {
    authorization: "Bearer privy-token",
    "content-type": "application/json",
  });
  assert.equal(calls[0]?.init?.body, JSON.stringify(candidateProfile));
});

test("maps 404 to ProfileNotFoundError", async () => {
  const fetcher: typeof fetch = async () =>
    jsonResponse(404, { error: "profile-not-found" });

  await assert.rejects(
    getProfile("recruiter", "privy-token", fetcher),
    ProfileNotFoundError,
  );
});

test("maps 401 and 403 to stable typed errors", async () => {
  const unauthorized: typeof fetch = async () =>
    jsonResponse(401, { error: "unauthorized" });
  const forbidden: typeof fetch = async () =>
    jsonResponse(403, { error: "role-not-active" });

  await assert.rejects(
    getProfile("candidate", "privy-token", unauthorized),
    ProfileUnauthorizedError,
  );
  await assert.rejects(
    saveProfile("candidate", candidateProfile, "privy-token", forbidden),
    ProfileForbiddenError,
  );
});

test("maps 500 to ProfileServerError", async () => {
  const fetcher: typeof fetch = async () =>
    jsonResponse(500, { error: "database-error" });

  await assert.rejects(
    getProfile("candidate", "privy-token", fetcher),
    ProfileServerError,
  );
});

test("maps invalid success responses to InvalidProfileResponseError", async () => {
  const fetcher: typeof fetch = async () =>
    jsonResponse(200, { candidate: candidateProfile });

  await assert.rejects(
    getProfile("candidate", "privy-token", fetcher),
    InvalidProfileResponseError,
  );
});
