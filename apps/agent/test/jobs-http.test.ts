import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { createRuntimeHttpServer } from "../src/server";
import { InMemoryJobQueue } from "../src/runtime/jobs/in-memory-job-queue";
import type { DurableJobRuntime } from "../src/runtime/jobs/bullmq-job-queue";

const SERVICE_TOKEN = "service-secret";
const serviceHeaders = {
  authorization: `Bearer ${SERVICE_TOKEN}`,
  "content-type": "application/json",
};

test("enqueues and polls a deterministic worker job", async () => {
  const queue = new InMemoryJobQueue();
  const server = await createRuntimeHttpServer({
    jobQueue: queue,
    serviceToken: SERVICE_TOKEN,
    processJob: async () => ({
      status: "ready",
      chain: "Celo",
      llmInvoked: false,
    }),
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));

  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const enqueueResponse = await fetch(`${baseUrl}/jobs`, {
      method: "POST",
      headers: serviceHeaders,
      body: JSON.stringify({
        name: "onchain-sync",
        payload: { chain: "Celo" },
      }),
    });
    const accepted = (await enqueueResponse.json()) as {
      jobId: string;
      status: string;
    };

    assert.equal(enqueueResponse.status, 202);
    assert.equal(accepted.status, "queued");

    let job: any;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const response = await fetch(`${baseUrl}/jobs/${accepted.jobId}`, {
        headers: serviceHeaders,
      });
      job = await response.json();
      if (job.status === "completed") {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    assert.equal(job.status, "completed");
    assert.equal(job.result.llmInvoked, false);
  } finally {
    server.close();
    await once(server, "close");
  }
});

test("rejects job enqueue and status requests without service token", async () => {
  const server = await createRuntimeHttpServer({
    serviceToken: SERVICE_TOKEN,
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));

  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const enqueueResponse = await fetch(`${baseUrl}/jobs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "onchain-sync",
        payload: { chain: "Celo" },
      }),
    });
    assert.equal(enqueueResponse.status, 401);
    assert.deepEqual(await enqueueResponse.json(), { status: "unauthorized" });

    const statusResponse = await fetch(`${baseUrl}/jobs/job-1`);
    assert.equal(statusResponse.status, 401);
    assert.deepEqual(await statusResponse.json(), { status: "unauthorized" });
  } finally {
    server.close();
    await once(server, "close");
  }
});

test("rejects invalid job payloads", async () => {
  const server = await createRuntimeHttpServer({
    serviceToken: SERVICE_TOKEN,
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));

  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const response = await fetch(
      `http://127.0.0.1:${address.port}/jobs`,
      {
        method: "POST",
        headers: serviceHeaders,
        body: JSON.stringify({
          name: "cv-parse",
          payload: { candidateId: "candidate-001", rawCv: "" },
        }),
      },
    );

    assert.equal(response.status, 400);
  } finally {
    server.close();
    await once(server, "close");
  }
});

test("accepts authenticated CV documents and enforces status ownership", async () => {
  let enqueued: any;
  const runtime: DurableJobRuntime = {
    async enqueue(request) {
      enqueued = request;
      return {
        id: "job-cv-1",
        name: request.name,
        payload: request.payload,
        status: "queued",
        attempts: 0,
        maxAttempts: 3,
        createdAt: new Date(0).toISOString(),
      };
    },
    async get(jobId, candidateId) {
      if (jobId !== "job-cv-1" || candidateId !== "candidate-1") {
        return undefined;
      }
      return {
        id: jobId,
        name: "cv-parse",
        payload: { candidateId, rawCv: "Senior Engineer" },
        status: "queued",
        attempts: 0,
        maxAttempts: 3,
        createdAt: new Date(0).toISOString(),
      };
    },
    async start() {},
    async close() {},
  };
  const server = await createRuntimeHttpServer({
    durableJobRuntime: runtime,
    serviceToken: SERVICE_TOKEN,
    extractCvDocument: async () => "Senior Engineer",
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));

  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const unauthorized = await fetch(`${baseUrl}/jobs/cv-document`, {
      method: "POST",
    });
    assert.equal(unauthorized.status, 401);

    const form = new FormData();
    form.set("candidateId", "candidate-1");
    form.set(
      "file",
      new Blob(["%PDF-1.7\nfake"], { type: "application/pdf" }),
      "cv.pdf",
    );
    const accepted = await fetch(`${baseUrl}/jobs/cv-document`, {
      method: "POST",
      headers: { authorization: `Bearer ${SERVICE_TOKEN}` },
      body: form,
    });
    assert.equal(accepted.status, 202);
    assert.deepEqual(enqueued, {
      name: "cv-parse",
      payload: { candidateId: "candidate-1", rawCv: "Senior Engineer" },
    });

    const owned = await fetch(
      `${baseUrl}/jobs/job-cv-1?candidateId=candidate-1`,
      { headers: { authorization: `Bearer ${SERVICE_TOKEN}` } },
    );
    assert.equal(owned.status, 200);

    const foreign = await fetch(
      `${baseUrl}/jobs/job-cv-1?candidateId=candidate-2`,
      { headers: { authorization: `Bearer ${SERVICE_TOKEN}` } },
    );
    assert.equal(foreign.status, 404);
  } finally {
    server.close();
    await once(server, "close");
  }
});

test("returns 503 when durable job status is unavailable", async () => {
  const runtime: DurableJobRuntime = {
    async enqueue() {
      throw new Error("unused");
    },
    async get() {
      throw new Error("redis unavailable");
    },
    async start() {},
    async close() {},
  };
  const server = await createRuntimeHttpServer({
    durableJobRuntime: runtime,
    serviceToken: SERVICE_TOKEN,
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));

  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const response = await fetch(
      `http://127.0.0.1:${address.port}/jobs/job-1?candidateId=candidate-1`,
      { headers: { authorization: `Bearer ${SERVICE_TOKEN}` } },
    );
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { status: "queue-unavailable" });
  } finally {
    server.close();
    await once(server, "close");
  }
});
