import assert from "node:assert/strict";
import test from "node:test";

import { resolveChatCallerKey, enforceChatRateLimit, type ChatCallerDependencies } from "../src/runtime/chat/caller";
import { createInMemoryRateLimiter } from "../src/runtime/auth/rate-limit";

test("resolves viewer ID from scope", () => {
  const body = {
    scope: {
      viewerId: "candidate-001",
      role: "candidate",
      resourceType: "job",
      resourceId: "job_001",
    },
    messages: [{ role: "user", content: "hello" }],
  };
  const ip = "127.0.0.1";

  const key = resolveChatCallerKey(body, ip);
  assert.equal(key, "viewer:candidate-001");
});

test("resolves viewer ID from scope.userId fallback", () => {
  const body = {
    scope: {
      userId: "user-123",
      role: "recruiter",
      resourceType: "candidate",
      resourceId: "candidate_001",
    },
    messages: [{ role: "user", content: "hello" }],
  };
  const ip = "192.168.1.1";

  const key = resolveChatCallerKey(body, ip);
  assert.equal(key, "viewer:user-123");
});

test("falls back to IP when no viewer ID", () => {
  const body = {
    messages: [{ role: "user", content: "hello" }],
  };
  const ip = "127.0.0.1";

  const key = resolveChatCallerKey(body, ip);
  assert.ok(key.startsWith("ip:"));
  assert.ok(key.includes("127.0.0.1"));
});

test("normalizes IPv6 mapped IPv4 addresses", () => {
  const body = {
    messages: [{ role: "user", content: "hello" }],
  };
  const ip = "::ffff:192.168.1.100";

  const key = resolveChatCallerKey(body, ip);
  assert.equal(key, "ip:192.168.1.100");
});

test("handles unknown IP gracefully", () => {
  const body = {
    messages: [{ role: "user", content: "hello" }],
  };
  const ip = undefined;

  const key = resolveChatCallerKey(body, ip);
  assert.ok(key.startsWith("unknown:"));
});

test("rate limit allows within limit", async () => {
  const rateLimiter = createInMemoryRateLimiter();
  const body = {
    scope: { viewerId: "candidate-001" },
    messages: [{ role: "user", content: "hello" }],
  };

  const dependencies: ChatCallerDependencies = {
    rateLimiter,
    ip: "127.0.0.1",
    now: () => 0,
  };

  const result1 = await enforceChatRateLimit(body, dependencies, 30, 60_000);
  assert.equal(result1.allowed, true);
  assert.equal(result1.callerKey, "viewer:candidate-001");

  const result2 = await enforceChatRateLimit(body, dependencies, 30, 60_000);
  assert.equal(result2.allowed, true);
});

test("rate limit blocks after exceeding", async () => {
  const rateLimiter = createInMemoryRateLimiter();
  const body = {
    scope: { viewerId: "candidate-002" },
    messages: [{ role: "user", content: "hello" }],
  };

  const dependencies: ChatCallerDependencies = {
    rateLimiter,
    ip: "127.0.0.1",
    now: () => 0,
  };

  // First request should succeed
  const result1 = await enforceChatRateLimitWithLimit(body, "127.0.0.1", dependencies, 2);
  assert.equal(result1.allowed, true);

  // Second request should succeed
  const result2 = await enforceChatRateLimitWithLimit(body, "127.0.0.1", dependencies, 2);
  assert.equal(result2.allowed, true);

  // Third request should be blocked
  const result3 = await enforceChatRateLimitWithLimit(body, "127.0.0.1", dependencies, 2);
  assert.equal(result3.allowed, false);
  assert.ok(result3.retryAfterSeconds > 0);
});

function enforceChatRateLimitWithLimit(
  body: unknown,
  ip: string | undefined,
  dependencies: ChatCallerDependencies,
  limit: number,
): Promise<{ allowed: boolean; callerKey: string; retryAfterSeconds?: number }> {
  const { rateLimiter, ip: clientIp } = dependencies;
  const callerKey = resolveChatCallerKey(body, clientIp);

  return rateLimiter.consume({
    key: callerKey,
    limit,
    windowMs: 60_000,
    now: dependencies.now?.() ?? Date.now(),
  }).then((result) => ({
    allowed: result.allowed,
    callerKey,
    retryAfterSeconds: result.retryAfterSeconds,
  }));
}

test("different viewer IDs use different rate limit keys", async () => {
  const rateLimiter = createInMemoryRateLimiter();
  const body1 = {
    scope: { viewerId: "candidate-003" },
    messages: [{ role: "user", content: "hello" }],
  };
  const body2 = {
    scope: { viewerId: "candidate-004" },
    messages: [{ role: "user", content: "hello" }],
  };

  const dependencies: ChatCallerDependencies = {
    rateLimiter,
    ip: "127.0.0.1",
    now: () => 0,
  };

  const result1 = await enforceChatRateLimit(body1, dependencies, 30, 60_000);
  const result2 = await enforceChatRateLimit(body2, dependencies, 30, 60_000);

  assert.equal(result1.allowed, true);
  assert.equal(result2.allowed, true);
});

test("rate limit with IP fallback uses independent keys", async () => {
  const rateLimiter = createInMemoryRateLimiter();
  const body = {
    messages: [{ role: "user", content: "hello" }],
  };

  const dep1 = {
    rateLimiter,
    ip: "192.168.1.1",
    now: () => 0,
  } as ChatCallerDependencies;

  const dep2 = {
    rateLimiter,
    ip: "192.168.1.2",
    now: () => 0,
  } as ChatCallerDependencies;

  await enforceChatRateLimit(body, dep1, 30, 60_000);
  const result = await enforceChatRateLimit(body, dep2, 30, 60_000);

  assert.equal(result.allowed, true);
});

test("rate limit returns caller key for telemetry", async () => {
  const rateLimiter = createInMemoryRateLimiter();
  const body = {
    scope: { viewerId: "test-user-123" },
    messages: [{ role: "user", content: "hello" }],
  };

  const dependencies: ChatCallerDependencies = {
    rateLimiter,
    ip: "10.0.0.1",
    now: () => 0,
  };

  const result = await enforceChatRateLimit(body, dependencies, 30, 60_000);
  assert.equal(result.callerKey, "viewer:test-user-123");
});
