import assert from "node:assert/strict";
import test from "node:test";

import {
  AuthenticatedUserError,
} from "../lib/server/authenticated-user";
import {
  createCandidateCvPostHandler,
  POST,
} from "../app/api/candidates/me/cv/route";
import {
  createCandidateCvJobGetHandler,
  GET,
} from "../app/api/candidates/me/cv/jobs/[jobId]/route";
import { createInMemoryProfileRepository } from "../lib/server/profile-repository";

test("CV upload rejects a request without a Stellar session (401)", async () => {
  await withEnvironment(
    {
      NODE_ENV: "production",
      SHIRE_AGENT_INTERNAL_URL: "http://agent.local",
      SHIRE_AGENT_SERVICE_TOKEN: "service-secret",
    },
    async () => {
      const response = await POST(
        new Request("http://localhost/api/candidates/me/cv", {
          method: "POST",
          body: new FormData(),
        }),
      );

      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), { error: "unauthorized" });
    },
  );
});

test("CV status rejects a request without a Stellar session (401)", async () => {
  await withEnvironment(
    {
      NODE_ENV: "production",
      SHIRE_AGENT_INTERNAL_URL: "http://agent.local",
      SHIRE_AGENT_SERVICE_TOKEN: "service-secret",
    },
    async () => {
      const response = await GET(
        new Request("http://localhost/api/candidates/me/cv/jobs/job-1"),
        { params: Promise.resolve({ jobId: "job-1" }) },
      );

      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), { error: "unauthorized" });
    },
  );
});

test("CV upload authenticates before checking agent configuration", async () => {
  await withEnvironment(
    {
      SHIRE_AGENT_INTERNAL_URL: undefined,
      SHIRE_AGENT_SERVICE_TOKEN: undefined,
    },
    async () => {
      const post = createCandidateCvPostHandler({
        resolveAuthenticatedUser: async () => {
          throw new AuthenticatedUserError("missing");
        },
      });

      const response = await post(
        new Request("http://localhost/api/candidates/me/cv", {
          method: "POST",
          body: new FormData(),
        }),
      );

      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), { error: "unauthorized" });
    },
  );
});

test("CV status checks authentication before agent configuration", async () => {
  await withEnvironment(
    {
      SHIRE_AGENT_INTERNAL_URL: undefined,
      SHIRE_AGENT_SERVICE_TOKEN: undefined,
    },
    async () => {
      const get = createCandidateCvJobGetHandler({
        resolveAuthenticatedUser: async () => {
          throw new AuthenticatedUserError("missing");
        },
      });

      const response = await get(
        new Request("http://localhost/api/candidates/me/cv/jobs/job-1"),
        { params: Promise.resolve({ jobId: "job-1" }) },
      );

      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), { error: "unauthorized" });
    },
  );
});

test("authenticated CV requests map missing agent configuration to stable 500", async () => {
  await withEnvironment(
    {
      SHIRE_AGENT_INTERNAL_URL: undefined,
      SHIRE_AGENT_SERVICE_TOKEN: undefined,
    },
    async () => {
      const repository = createInMemoryProfileRepository();
      const post = createCandidateCvPostHandler({
        resolveAuthenticatedUser: async () => ({
          mode: "stellar",
          privyUserId: "did:privy:user-1",
          walletAddress: "GTESTAUTH",
        }),
        repository,
      });

      const response = await post(
        new Request("http://localhost/api/candidates/me/cv", {
          method: "POST",
          body: new FormData(),
        }),
      );

      assert.equal(response.status, 500);
      assert.deepEqual(await response.json(), {
        error: "missing-agent-configuration",
      });
    },
  );
});

test("malformed CV multipart requests return stable 400", async () => {
  await withEnvironment(
    {
      SHIRE_AGENT_INTERNAL_URL: "http://agent.local",
      SHIRE_AGENT_SERVICE_TOKEN: "service-secret",
    },
    async () => {
      const post = createCandidateCvPostHandler({
        resolveAuthenticatedUser: async () => ({
          mode: "stellar",
          privyUserId: "did:privy:user-1",
          walletAddress: "GTESTAUTH",
        }),
        repository: createInMemoryProfileRepository(),
      });

      const response = await post(
        new Request("http://localhost/api/candidates/me/cv", {
          method: "POST",
          headers: { "content-type": "multipart/form-data; boundary=broken" },
          body: "not-a-valid-multipart-body",
        }),
      );

      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), { error: "invalid-multipart" });
    },
  );
});

test("CV upload forwards the internal Shire user UUID as candidateId", async () => {
  const previousUrl = process.env.SHIRE_AGENT_INTERNAL_URL;
  const previousToken = process.env.SHIRE_AGENT_SERVICE_TOKEN;
  process.env.SHIRE_AGENT_INTERNAL_URL = "http://agent.local";
  process.env.SHIRE_AGENT_SERVICE_TOKEN = "service-secret";
  const repository = createInMemoryProfileRepository();
  const user = await repository.resolveUser("did:privy:user-1");
  let forwardedCandidateId: FormDataEntryValue | null = null;
  let forwardedAuthorization: string | null = null;

  const post = createCandidateCvPostHandler({
    resolveAuthenticatedUser: async () => ({
      mode: "stellar",
          privyUserId: "did:privy:user-1",
          walletAddress: "GTESTAUTH",
    }),
    repository,
    fetch: async (_input, init) => {
      const form = init?.body as FormData;
      forwardedCandidateId = form.get("candidateId");
      forwardedAuthorization = new Headers(init?.headers).get("authorization");
      return Response.json(
        { jobId: "job-1", status: "queued" },
        { status: 202 },
      );
    },
  });

  try {
    const form = new FormData();
    form.set("candidateId", "attacker-controlled");
    form.set(
      "file",
      new Blob(["%PDF-1.7"], { type: "application/pdf" }),
      "cv.pdf",
    );
    const response = await post(
      new Request("http://localhost/api/candidates/me/cv", {
        method: "POST",
        body: form,
      }),
    );

    assert.equal(response.status, 202);
    assert.equal(forwardedCandidateId, user.id);
    assert.equal(forwardedAuthorization, "Bearer service-secret");
  } finally {
    restore("SHIRE_AGENT_INTERNAL_URL", previousUrl);
    restore("SHIRE_AGENT_SERVICE_TOKEN", previousToken);
  }
});

test("CV polling checks ownership with the internal Shire user UUID", async () => {
  const previousUrl = process.env.SHIRE_AGENT_INTERNAL_URL;
  const previousToken = process.env.SHIRE_AGENT_SERVICE_TOKEN;
  process.env.SHIRE_AGENT_INTERNAL_URL = "http://agent.local/";
  process.env.SHIRE_AGENT_SERVICE_TOKEN = "service-secret";
  const repository = createInMemoryProfileRepository();
  const user = await repository.resolveUser("did:privy:user-1");
  let forwardedUrl = "";

  const get = createCandidateCvJobGetHandler({
    resolveAuthenticatedUser: async () => ({
      mode: "stellar",
          privyUserId: "did:privy:user-1",
          walletAddress: "GTESTAUTH",
    }),
    repository,
    fetch: async (input) => {
      forwardedUrl = String(input);
      return Response.json({
        id: "job-1",
        name: "cv-parse",
        payload: {
          candidateId: user.id,
          rawCv: "private raw CV",
        },
        status: "completed",
        attempts: 2,
        maxAttempts: 3,
        result: {
          profile: { fullName: "Maya Okafor", skills: ["TypeScript"] },
          usage: [{ provider: "openrouter", model: "private-model" }],
          candidateId: user.id,
          status: "PENDING_REVIEW",
        },
        provider: "private-provider",
      });
    },
  });

  try {
    const response = await get(
      new Request("http://localhost/api/candidates/me/cv/jobs/job-1"),
      { params: Promise.resolve({ jobId: "job-1" }) },
    );
    assert.equal(response.status, 200);
    assert.equal(
      forwardedUrl,
      `http://agent.local/jobs/job-1?candidateId=${user.id}`,
    );
    assert.deepEqual(await response.json(), {
      status: "completed",
      attempts: 2,
      maxAttempts: 3,
      result: {
        profile: { fullName: "Maya Okafor", skills: ["TypeScript"] },
      },
    });
  } finally {
    restore("SHIRE_AGENT_INTERNAL_URL", previousUrl);
    restore("SHIRE_AGENT_SERVICE_TOKEN", previousToken);
  }
});

test("CV polling returns only public delayed and failed fields", async () => {
  await withEnvironment(
    {
      SHIRE_AGENT_INTERNAL_URL: "http://agent.local",
      SHIRE_AGENT_SERVICE_TOKEN: "service-secret",
    },
    async () => {
      const repository = createInMemoryProfileRepository();
      const responses = [
        {
          status: "delayed",
          attempts: 1,
          maxAttempts: 3,
          nextRetryAt: "2026-06-16T10:00:00.000Z",
          payload: { rawCv: "private" },
        },
        {
          status: "failed",
          attempts: 3,
          maxAttempts: 3,
          error: { code: "private-code", message: "Provider unavailable" },
          usage: [{ provider: "private-provider" }],
        },
      ];
      const get = createCandidateCvJobGetHandler({
        resolveAuthenticatedUser: async () => ({
          mode: "stellar",
          privyUserId: "did:privy:user-1",
          walletAddress: "GTESTAUTH",
        }),
        repository,
        fetch: async () => Response.json(responses.shift()),
      });

      const delayed = await get(
        new Request("http://localhost/api/candidates/me/cv/jobs/job-1"),
        { params: { jobId: "job-1" } },
      );
      const failed = await get(
        new Request("http://localhost/api/candidates/me/cv/jobs/job-1"),
        { params: { jobId: "job-1" } },
      );

      assert.deepEqual(await delayed.json(), {
        status: "delayed",
        attempts: 1,
        maxAttempts: 3,
        nextRetryAt: "2026-06-16T10:00:00.000Z",
      });
      assert.deepEqual(await failed.json(), {
        status: "failed",
        attempts: 3,
        maxAttempts: 3,
        error: { message: "Provider unavailable" },
      });
    },
  );
});

test("CV polling rejects non-JSON upstream responses", async () => {
  await withEnvironment(
    {
      SHIRE_AGENT_INTERNAL_URL: "http://agent.local",
      SHIRE_AGENT_SERVICE_TOKEN: "service-secret",
    },
    async () => {
      const get = createCandidateCvJobGetHandler({
        resolveAuthenticatedUser: async () => ({
          mode: "stellar",
          privyUserId: "did:privy:user-1",
          walletAddress: "GTESTAUTH",
        }),
        repository: createInMemoryProfileRepository(),
        fetch: async () =>
          new Response("<html>upstream failure</html>", {
            status: 502,
            headers: { "content-type": "text/html" },
          }),
      });

      const response = await get(
        new Request("http://localhost/api/candidates/me/cv/jobs/job-1"),
        { params: { jobId: "job-1" } },
      );

      assert.equal(response.status, 502);
      assert.deepEqual(await response.json(), {
        error: "invalid-agent-response",
      });
    },
  );
});

function restore(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

async function withEnvironment(
  values: Record<string, string | undefined>,
  operation: () => Promise<void>,
) {
  const previous = Object.fromEntries(
    Object.keys(values).map((key) => [key, process.env[key]]),
  );
  for (const [key, value] of Object.entries(values)) {
    restore(key, value);
  }
  try {
    await operation();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      restore(key, value);
    }
  }
}
