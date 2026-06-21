import assert from "node:assert/strict";
import test from "node:test";

import { createEnv, env } from "../src/env";
import {
  getCapabilityPolicy,
  shouldEscalate,
} from "../src/runtime/model-policy";
import {
  createModelFallbackChain,
  dynamicAgentModel,
  resolveModelChain,
  resolveRuntimeAgentModelId,
} from "../src/runtime/model-router";

test("keeps CV confidence policy without model tiers", () => {
  assert.equal(
    getCapabilityPolicy("cv-normalization").confidenceThreshold,
    0.7,
  );
  assert.equal(getCapabilityPolicy("dispute-summary").maxOutputTokens, 2_000);
});

test("escalates invalid CV output only after two schema failures", () => {
  assert.equal(
    shouldEscalate({
      capability: "cv-normalization",
      schemaFailureCount: 1,
      confidence: 0.4,
    }),
    false,
  );
  assert.equal(
    shouldEscalate({
      capability: "cv-normalization",
      schemaFailureCount: 2,
      confidence: 0.4,
    }),
    true,
  );
});

test("escalates a schema-valid CV profile with low confidence", () => {
  assert.equal(
    shouldEscalate({
      capability: "cv-normalization",
      schemaFailureCount: 0,
      confidence: 0.4,
    }),
    true,
  );
});

test("creates a Mastra fallback entry for each configured model", () => {
  assert.deepEqual(
    createModelFallbackChain(["openrouter/free", "zai/glm", "openai/mini"]),
    [
      { model: "openrouter/free", maxRetries: 1 },
      { model: "zai/glm", maxRetries: 1 },
      { model: "openai/mini", maxRetries: 1 },
    ],
  );
});

test("resolves model chain by capability", () => {
  const runtime = createEnv({
    SHIRE_MODEL_DEFAULT: "openrouter/default",
    SHIRE_MODEL_PRODUCT_QNA: "openrouter/product",
  } as NodeJS.ProcessEnv);

  assert.deepEqual(resolveModelChain({ capability: "product-qna", runtime }), [
    { model: "openrouter/product", maxRetries: 1 },
  ]);
  assert.deepEqual(
    resolveModelChain({ capability: "cv-normalization", runtime }),
    [{ model: "openrouter/default", maxRetries: 1 }],
  );
});

test("uses the default configured model when capability is missing", () => {
  const result = resolveRuntimeAgentModelId();

  assert.equal(result, "openrouter/nex-agi/nex-n2-pro:free");
});

test("dynamic agent model reads model-capability request context", () => {
  const requestContext = new Map<string, unknown>();
  requestContext.set("model-capability", "product-qna");

  const result = dynamicAgentModel({
    requestContext: { get: (key: string) => requestContext.get(key) },
  });

  assert.equal(result[0]?.model, env.chatModelChains.productQna[0]);
});
