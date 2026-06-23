import assert from "node:assert/strict";
import test from "node:test";

import { createInMemoryRateLimiter } from "../src/runtime/auth/rate-limit";

test("allows requests within limit", async () => {
  const limiter = createInMemoryRateLimiter();

  const result1 = await limiter.consume({
    key: "test:123",
    limit: 3,
    windowMs: 60_000,
    now: 0,
  });
  assert.equal(result1.allowed, true);
  assert.equal(result1.remaining, 2);
  assert.equal(result1.retryAfterSeconds, 0);

  const result2 = await limiter.consume({
    key: "test:123",
    limit: 3,
    windowMs: 60_000,
    now: 1_000,
  });
  assert.equal(result2.allowed, true);
  assert.equal(result2.remaining, 1);
  assert.equal(result2.retryAfterSeconds, 0);

  const result3 = await limiter.consume({
    key: "test:123",
    limit: 3,
    windowMs: 60_000,
    now: 2_000,
  });
  assert.equal(result3.allowed, true);
  assert.equal(result3.remaining, 0);
  assert.equal(result3.retryAfterSeconds, 0);
});

test("blocks requests exceeding limit", async () => {
  const limiter = createInMemoryRateLimiter();

  await limiter.consume({ key: "test:456", limit: 2, windowMs: 60_000, now: 0 });
  await limiter.consume({ key: "test:456", limit: 2, windowMs: 60_000, now: 1_000 });

  const result = await limiter.consume({
    key: "test:456",
    limit: 2,
    windowMs: 60_000,
    now: 2_000,
  });
  assert.equal(result.allowed, false);
  assert.equal(result.remaining, 0);
  assert.ok(result.retryAfterSeconds > 0);
});

test("uses independent keys", async () => {
  const limiter = createInMemoryRateLimiter();

  await limiter.consume({ key: "user:1", limit: 1, windowMs: 60_000, now: 0 });
  const result1 = await limiter.consume({
    key: "user:1",
    limit: 1,
    windowMs: 60_000,
    now: 1_000,
  });
  assert.equal(result1.allowed, false);

  const result2 = await limiter.consume({
    key: "user:2",
    limit: 1,
    windowMs: 60_000,
    now: 1_000,
  });
  assert.equal(result2.allowed, true);
});

test("resets after window expires", async () => {
  const limiter = createInMemoryRateLimiter();

  await limiter.consume({ key: "test:789", limit: 2, windowMs: 1_000, now: 0 });
  await limiter.consume({ key: "test:789", limit: 2, windowMs: 1_000, now: 100 });

  const result1 = await limiter.consume({
    key: "test:789",
    limit: 2,
    windowMs: 1_000,
    now: 500,
  });
  assert.equal(result1.allowed, false);

  // After window expires
  const result2 = await limiter.consume({
    key: "test:789",
    limit: 2,
    windowMs: 1_000,
    now: 1_500,
  });
  assert.equal(result2.allowed, true);
  assert.equal(result2.remaining, 1);
  assert.equal(result2.retryAfterSeconds, 0);
});

test("handles zero limit correctly (always blocks)", async () => {
  const limiter = createInMemoryRateLimiter();

  const result1 = await limiter.consume({
    key: "test:0",
    limit: 0,
    windowMs: 60_000,
    now: 0,
  });
  assert.equal(result1.allowed, false);
  assert.equal(result1.remaining, 0);
  assert.equal(result1.retryAfterSeconds, 60);
});

test("accepts custom timestamp", async () => {
  const limiter = createInMemoryRateLimiter();

  const result1 = await limiter.consume({
    key: "test:custom",
    limit: 10,
    windowMs: 10_000,
    now: 1_700_000_000_000,
  });
  assert.equal(result1.allowed, true);
});

test("clears entries on window reset", async () => {
  const limiter = createInMemoryRateLimiter();

  // Exhaust the limit
  await limiter.consume({ key: "test:clear", limit: 2, windowMs: 1_000, now: 0 });

  // Wait for window to expire
  const result1 = await limiter.consume({
    key: "test:clear",
    limit: 2,
    windowMs: 1_000,
    now: 1_500,
  });
  assert.equal(result1.allowed, true);

  // Should be able to consume again in the new window
  const result2 = await limiter.consume({
    key: "test:clear",
    limit: 2,
    windowMs: 1_000,
    now: 1_500,
  });
  assert.equal(result2.allowed, true);
});
