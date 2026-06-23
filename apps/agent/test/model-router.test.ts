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
    createModelFallbackChain(
      ["MiniMax-M3", "openai/gpt-4.1-mini"],
      {
        textModelProvider: "tokenrouter",
        textModelBaseUrl: "https://api.tokenrouter.com/v1",
        textModelApiKey: "test-key",
      },
    ),
    [
      {
        model: {
          providerId: "tokenrouter",
          modelId: "MiniMax-M3",
          url: "https://api.tokenrouter.com/v1",
          apiKey: "test-key",
        },
        maxRetries: 1,
      },
      {
        model: {
          providerId: "openai",
          modelId: "gpt-4.1-mini",
          url: "https://api.tokenrouter.com/v1",
          apiKey: "test-key",
        },
        maxRetries: 1,
      },
    ],
  );
});

test("resolves model chain by capability", () => {
  const runtime = createEnv({
    SHIRE_TEXT_MODEL: "MiniMax-M3",
    SHIRE_TEXT_API_KEY: "test-key",
    SHIRE_MODEL_PRODUCT_QNA: "openrouter/product",
  } as NodeJS.ProcessEnv);

  assert.deepEqual(resolveModelChain({ capability: "product-qna", runtime }), [
    {
      model: {
        providerId: "openrouter",
        modelId: "product",
        url: "https://api.tokenrouter.com/v1",
        apiKey: "test-key",
      },
      maxRetries: 1,
    },
  ]);
  assert.deepEqual(
    resolveModelChain({ capability: "cv-normalization", runtime }),
    [
      {
        model: {
          providerId: "tokenrouter",
          modelId: "MiniMax-M3",
          url: "https://api.tokenrouter.com/v1",
          apiKey: "test-key",
        },
        maxRetries: 1,
      },
    ],
  );
});

test("uses the default configured model when capability is missing", () => {
  const result = resolveRuntimeAgentModelId();

  assert.equal(result, "MiniMax-M3");
});

test("dynamic agent model reads model-capability request context", () => {
  const requestContext = new Map<string, unknown>();
  requestContext.set("model-capability", "product-qna");

  const result = dynamicAgentModel({
    requestContext: { get: (key: string) => requestContext.get(key) },
  });

  assert.deepEqual(result[0]?.model, {
    providerId: "tokenrouter",
    modelId: env.chatModelChains.productQna[0],
    url: env.textModelBaseUrl,
    apiKey: env.textModelApiKey,
  });
});
