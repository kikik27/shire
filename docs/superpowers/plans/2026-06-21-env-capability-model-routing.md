# Env Capability Model Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace tier-based model routing with explicit env-driven chat and embedding capability routing.

**Architecture:** `env.ts` owns parsing and defaults. `model-router.ts` resolves chat model chains by capability. `embeddings.ts` resolves embedding models by capability so memory, product knowledge, and repository knowledge can use different providers without changing code.

**Tech Stack:** TypeScript, Mastra Agent, Mastra Memory, LibSQL Vector, Vercel AI SDK `embed`/`embedMany`, Node test runner.

---

## File Structure

- Modify `apps/agent/src/env.ts`: parse capability model chains and embedding capability configs; remove `modelChains.cheap/balanced/heavy`.
- Modify `apps/agent/src/runtime/model-policy.ts`: replace tier policy with capability policy metadata.
- Modify `apps/agent/src/runtime/model-router.ts`: resolve model chains by `model-capability` request context.
- Modify `apps/agent/src/runtime/embeddings.ts`: add `EmbeddingCapability` helpers.
- Modify `apps/agent/src/runtime/memory.ts`: use `memory` embedding capability.
- Modify `apps/agent/src/runtime/knowledge.ts`: use `product-knowledge` and `repository-knowledge` embedding capabilities consistently.
- Modify `apps/agent/src/runtime/product-qna.ts`: set `model-capability` to `product-qna`.
- Modify agent/job call sites that currently set `workload` when they should set `model-capability`.
- Modify `apps/agent/test/env.test.ts`, `apps/agent/test/model-router.test.ts`, `apps/agent/test/embeddings.test.ts`, `apps/agent/test/knowledge.test.ts`, `apps/agent/test/memory.test.ts`, and `apps/agent/test/product-qna.test.ts`.
- Modify `apps/agent/README.md` and `apps/agent/.env.example`.

### Task 1: Env Capability Parsing

**Files:**
- Modify: `apps/agent/src/env.ts`
- Test: `apps/agent/test/env.test.ts`

- [ ] **Step 1: Write failing env tests**

Add tests covering capability model chains and embedding fallbacks:

```ts
test("parses chat model capabilities from env", () => {
  const parsed = createEnv({
    SHIRE_MODEL_DEFAULT: "openrouter/default-a,openrouter/default-b",
    SHIRE_MODEL_PRODUCT_QNA: "openrouter/product",
    SHIRE_MODEL_DISPUTE_SUMMARY: "openrouter/dispute",
  } as NodeJS.ProcessEnv);

  assert.deepEqual(parsed.chatModelChains.default, [
    "openrouter/default-a",
    "openrouter/default-b",
  ]);
  assert.deepEqual(parsed.chatModelChains.productQna, [
    "openrouter/product",
  ]);
  assert.deepEqual(parsed.chatModelChains.disputeSummary, [
    "openrouter/dispute",
  ]);
  assert.deepEqual(parsed.chatModelChains.cvNormalization, [
    "openrouter/default-a",
    "openrouter/default-b",
  ]);
});

test("parses embedding capabilities from env", () => {
  const parsed = createEnv({
    SHIRE_MODEL_DEFAULT: "openrouter/default",
    SHIRE_EMBEDDING_MODEL_DEFAULT: "embedding/default",
    SHIRE_EMBEDDING_MODEL_MEMORY: "embedding/memory",
    SHIRE_EMBEDDING_BASE_URL_DEFAULT: "https://example.test/v1/",
    SHIRE_EMBEDDING_BASE_URL_PRODUCT_KNOWLEDGE: "https://product.test/v1/",
  } as NodeJS.ProcessEnv);

  assert.equal(parsed.embeddingModels.default, "embedding/default");
  assert.equal(parsed.embeddingModels.memory, "embedding/memory");
  assert.equal(parsed.embeddingModels.productKnowledge, "embedding/default");
  assert.equal(parsed.embeddingBaseUrls.default, "https://example.test/v1");
  assert.equal(
    parsed.embeddingBaseUrls.productKnowledge,
    "https://product.test/v1",
  );
  assert.equal(parsed.embeddingBaseUrls.repositoryKnowledge, "https://example.test/v1");
});
```

- [ ] **Step 2: Run env tests to verify failure**

Run:

```powershell
npm run test --workspace=@shire/agent -- test/env.test.ts
```

Expected: FAIL because `chatModelChains` and embedding capability maps do not exist yet.

- [ ] **Step 3: Implement env parsing**

In `apps/agent/src/env.ts`, replace `modelChains` with:

```ts
const defaultChatModels = parseRequiredModelChain(input.SHIRE_MODEL_DEFAULT, [
  "openrouter/nex-agi/nex-n2-pro:free",
  "openrouter/openai/gpt-oss-20b:free",
]);

const defaultEmbeddingModel =
  input.SHIRE_EMBEDDING_MODEL_DEFAULT?.trim() || "qwen/qwen3-embedding-8b";
const defaultEmbeddingBaseUrl = normalizeBaseUrl(
  input.SHIRE_EMBEDDING_BASE_URL_DEFAULT?.trim() ||
    "https://openrouter.ai/api/v1",
);
```

Return:

```ts
chatModelChains: {
  default: defaultChatModels,
  productQna: parseModelChain(input.SHIRE_MODEL_PRODUCT_QNA, defaultChatModels),
  roleAwareChat: parseModelChain(input.SHIRE_MODEL_ROLE_AWARE_CHAT, defaultChatModels),
  cvNormalization: parseModelChain(input.SHIRE_MODEL_CV_NORMALIZATION, defaultChatModels),
  knowledgeSynthesis: parseModelChain(input.SHIRE_MODEL_KNOWLEDGE_SYNTHESIS, defaultChatModels),
  jobRerank: parseModelChain(input.SHIRE_MODEL_JOB_RERANK, defaultChatModels),
  talentRerank: parseModelChain(input.SHIRE_MODEL_TALENT_RERANK, defaultChatModels),
  recommendationExplanation: parseModelChain(input.SHIRE_MODEL_RECOMMENDATION_EXPLANATION, defaultChatModels),
  workflowSummary: parseModelChain(input.SHIRE_MODEL_WORKFLOW_SUMMARY, defaultChatModels),
  disputeSummary: parseModelChain(input.SHIRE_MODEL_DISPUTE_SUMMARY, defaultChatModels),
  securityGuard: parseModelChain(input.SHIRE_MODEL_SECURITY_GUARD, defaultChatModels),
},
embeddingModels: {
  default: defaultEmbeddingModel,
  memory: input.SHIRE_EMBEDDING_MODEL_MEMORY?.trim() || defaultEmbeddingModel,
  productKnowledge: input.SHIRE_EMBEDDING_MODEL_PRODUCT_KNOWLEDGE?.trim() || defaultEmbeddingModel,
  repositoryKnowledge: input.SHIRE_EMBEDDING_MODEL_REPOSITORY_KNOWLEDGE?.trim() || defaultEmbeddingModel,
},
embeddingBaseUrls: {
  default: defaultEmbeddingBaseUrl,
  memory: normalizeBaseUrl(input.SHIRE_EMBEDDING_BASE_URL_MEMORY?.trim() || defaultEmbeddingBaseUrl),
  productKnowledge: normalizeBaseUrl(input.SHIRE_EMBEDDING_BASE_URL_PRODUCT_KNOWLEDGE?.trim() || defaultEmbeddingBaseUrl),
  repositoryKnowledge: normalizeBaseUrl(input.SHIRE_EMBEDDING_BASE_URL_REPOSITORY_KNOWLEDGE?.trim() || defaultEmbeddingBaseUrl),
},
```

Add:

```ts
function parseRequiredModelChain(
  value: string | undefined,
  defaults: readonly string[],
) {
  return parseModelChain(value, defaults);
}
```

- [ ] **Step 4: Run env tests**

Run:

```powershell
npm run test --workspace=@shire/agent -- test/env.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add -- apps/agent/src/env.ts apps/agent/test/env.test.ts
git commit -m "feat(agent): parse capability model env"
```

### Task 2: Chat Model Router

**Files:**
- Modify: `apps/agent/src/runtime/model-policy.ts`
- Modify: `apps/agent/src/runtime/model-router.ts`
- Test: `apps/agent/test/model-router.test.ts`

- [ ] **Step 1: Write failing router tests**

Add tests:

```ts
test("resolves model chain by capability", () => {
  const runtime = createEnv({
    SHIRE_MODEL_DEFAULT: "openrouter/default",
    SHIRE_MODEL_PRODUCT_QNA: "openrouter/product",
  } as NodeJS.ProcessEnv);

  assert.deepEqual(resolveModelChain({ capability: "product-qna", runtime }), [
    { model: "openrouter/product", maxRetries: 1 },
  ]);
  assert.deepEqual(resolveModelChain({ capability: "cv-normalization", runtime }), [
    { model: "openrouter/default", maxRetries: 1 },
  ]);
});

test("dynamic agent model reads model-capability request context", () => {
  const requestContext = new Map<string, unknown>();
  requestContext.set("model-capability", "product-qna");

  const result = dynamicAgentModel({
    requestContext: { get: (key: string) => requestContext.get(key) },
  });

  assert.equal(result[0]?.model, env.chatModelChains.productQna[0]);
});
```

- [ ] **Step 2: Run router tests to verify failure**

Run:

```powershell
npm run test --workspace=@shire/agent -- test/model-router.test.ts
```

Expected: FAIL because `capability` routing does not exist yet.

- [ ] **Step 3: Implement capability router**

In `model-policy.ts`, define:

```ts
export type ChatModelCapability =
  | "product-qna"
  | "role-aware-chat"
  | "cv-normalization"
  | "knowledge-synthesis"
  | "job-rerank"
  | "talent-rerank"
  | "recommendation-explanation"
  | "workflow-summary"
  | "dispute-summary"
  | "security-guard";
```

Keep `maxOutputTokens` and confidence metadata keyed by capability, but remove
`ModelTier` and `tier`.

In `model-router.ts`, implement:

```ts
function getCapabilityChain(
  runtime: Pick<typeof env, "chatModelChains">,
  capability: ChatModelCapability,
) {
  const key = toEnvCapabilityKey(capability);
  return runtime.chatModelChains[key] ?? runtime.chatModelChains.default;
}
```

Use a literal switch for `toEnvCapabilityKey` so TypeScript catches missing
capabilities.

- [ ] **Step 4: Run router tests**

Run:

```powershell
npm run test --workspace=@shire/agent -- test/model-router.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add -- apps/agent/src/runtime/model-policy.ts apps/agent/src/runtime/model-router.ts apps/agent/test/model-router.test.ts
git commit -m "feat(agent): route chat models by capability"
```

### Task 3: Embedding Capability Router

**Files:**
- Modify: `apps/agent/src/runtime/embeddings.ts`
- Test: `apps/agent/test/embeddings.test.ts`

- [ ] **Step 1: Write failing embedding tests**

Add:

```ts
test("creates embedding config for a specific capability", () => {
  const runtime = createEnv({
    SHIRE_MODEL_DEFAULT: "openrouter/default",
    SHIRE_EMBEDDING_MODEL_DEFAULT: "embedding/default",
    SHIRE_EMBEDDING_MODEL_MEMORY: "embedding/memory",
    SHIRE_EMBEDDING_BASE_URL_DEFAULT: "https://default.test/v1",
    SHIRE_EMBEDDING_BASE_URL_MEMORY: "https://memory.test/v1",
  } as NodeJS.ProcessEnv);

  assert.deepEqual(resolveEmbeddingConfig("memory", runtime), {
    modelId: "embedding/memory",
    baseUrl: "https://memory.test/v1",
  });
  assert.deepEqual(resolveEmbeddingConfig("product-knowledge", runtime), {
    modelId: "embedding/default",
    baseUrl: "https://default.test/v1",
  });
});
```

- [ ] **Step 2: Run embedding tests to verify failure**

Run:

```powershell
npm run test --workspace=@shire/agent -- test/embeddings.test.ts
```

Expected: FAIL because `resolveEmbeddingConfig` does not exist yet.

- [ ] **Step 3: Implement embedding capability helpers**

Add:

```ts
export type EmbeddingCapability =
  | "memory"
  | "product-knowledge"
  | "repository-knowledge";

export function resolveEmbeddingConfig(
  capability: EmbeddingCapability,
  runtime = env,
) {
  if (capability === "memory") {
    return {
      modelId: runtime.embeddingModels.memory,
      baseUrl: runtime.embeddingBaseUrls.memory,
    };
  }

  if (capability === "product-knowledge") {
    return {
      modelId: runtime.embeddingModels.productKnowledge,
      baseUrl: runtime.embeddingBaseUrls.productKnowledge,
    };
  }

  return {
    modelId: runtime.embeddingModels.repositoryKnowledge,
    baseUrl: runtime.embeddingBaseUrls.repositoryKnowledge,
  };
}
```

Then implement `createEmbeddingModelFor`, `embedTextFor`, and `embedTextsFor`.

- [ ] **Step 4: Run embedding tests**

Run:

```powershell
npm run test --workspace=@shire/agent -- test/embeddings.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add -- apps/agent/src/runtime/embeddings.ts apps/agent/test/embeddings.test.ts
git commit -m "feat(agent): route embeddings by capability"
```

### Task 4: Wire Memory And Knowledge Retrieval

**Files:**
- Modify: `apps/agent/src/runtime/memory.ts`
- Modify: `apps/agent/src/runtime/knowledge.ts`
- Test: `apps/agent/test/memory.test.ts`
- Test: `apps/agent/test/knowledge.test.ts`

- [ ] **Step 1: Write failing memory and knowledge tests**

Add or update tests so they inject fake embedders and assert capability:

```ts
test("memory config uses memory embedding capability", () => {
  const runtime = createEnv({
    SHIRE_MODEL_DEFAULT: "openrouter/default",
    SHIRE_EMBEDDING_MODEL_DEFAULT: "embedding/default",
    SHIRE_EMBEDDING_MODEL_MEMORY: "embedding/memory",
  } as NodeJS.ProcessEnv);

  const config = buildAgentMemoryConfig(runtime);

  assert.equal(runtime.embeddingModels.memory, "embedding/memory");
  assert.ok(config.embedder);
});
```

Add a knowledge test:

```ts
test("product knowledge search embeds queries with product knowledge capability", async () => {
  let receivedQuery = "";

  await searchProductKnowledge("How does staking work?", "candidate", {
    embeddingsEnabled: true,
    indexes: ["shire_context"],
    embed: async (query) => {
      receivedQuery = query;
      return { embedding: [0.1, 0.2] };
    },
    query: async () => [],
    localDocuments: [],
  });

  assert.equal(receivedQuery, "How does staking work?");
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
npm run test --workspace=@shire/agent -- test/memory.test.ts test/knowledge.test.ts
```

Expected: FAIL until call sites use capability helpers.

- [ ] **Step 3: Update memory and knowledge code**

In `memory.ts`, replace `createEmbeddingModel(...)` with:

```ts
embedder: createEmbeddingModelFor("memory", normalizedRuntime),
```

In `knowledge.ts`, use:

```ts
const defaultEmbed =
  filter.corpus === "product"
    ? (query: string) => embedTextFor("product-knowledge", query)
    : (query: string) => embedTextFor("repository-knowledge", query);
```

For `syncKnowledgeBase`, select embeddings by source corpus:

```ts
const embed =
  input?.embed ??
  ((values: string[], corpus: KnowledgeCorpus) =>
    embedTextsFor(
      corpus === "product" ? "product-knowledge" : "repository-knowledge",
      values,
    ));
```

- [ ] **Step 4: Run memory and knowledge tests**

Run:

```powershell
npm run test --workspace=@shire/agent -- test/memory.test.ts test/knowledge.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add -- apps/agent/src/runtime/memory.ts apps/agent/src/runtime/knowledge.ts apps/agent/test/memory.test.ts apps/agent/test/knowledge.test.ts
git commit -m "feat(agent): use capability embeddings for memory and knowledge"
```

### Task 5: Wire Agent Capabilities

**Files:**
- Modify: `apps/agent/src/runtime/product-qna.ts`
- Modify: `apps/agent/src/mastra/agents/*.ts` only where needed.
- Modify: `apps/agent/src/jobs/*.ts` only where request context is created.
- Test: `apps/agent/test/product-qna.test.ts`
- Test: `apps/agent/test/model-router.test.ts`

- [ ] **Step 1: Write failing product Q&A capability test**

Update the existing product Q&A fake agent assertion:

```ts
agent: {
  generate: async (_messages, options) => {
    const requestContext = (options as { requestContext: RequestContext })
      .requestContext;
    assert.equal(requestContext.get("model-capability"), "product-qna");
    return { text: "Shire supports candidate and recruiter roles." };
  },
},
```

- [ ] **Step 2: Run product Q&A test to verify failure**

Run:

```powershell
npm run test --workspace=@shire/agent -- test/product-qna.test.ts
```

Expected: FAIL because the code still sets `workload`.

- [ ] **Step 3: Set model capability in product Q&A**

In `product-qna.ts`, replace:

```ts
requestContext.set("workload", "knowledge-synthesis");
```

with:

```ts
requestContext.set("model-capability", "product-qna");
```

Keep max output token lookup capability-based:

```ts
maxOutputTokens: getCapabilityPolicy("product-qna").maxOutputTokens,
```

- [ ] **Step 4: Migrate remaining request-context call sites**

Search:

```powershell
rg 'requestContext\.set\("workload"|tier-override|SHIRE_MODEL_CHEAP|SHIRE_MODEL_BALANCED|SHIRE_MODEL_HEAVY|modelChains' apps/agent/src apps/agent/test
```

For each real model invocation, set the corresponding `model-capability`.

- [ ] **Step 5: Run focused tests**

Run:

```powershell
npm run test --workspace=@shire/agent -- test/product-qna.test.ts test/model-router.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add -- apps/agent/src apps/agent/test/product-qna.test.ts apps/agent/test/model-router.test.ts
git commit -m "feat(agent): set chat model capabilities"
```

### Task 6: Documentation And Env Example

**Files:**
- Modify: `apps/agent/README.md`
- Modify: `apps/agent/.env.example`
- Optional: `.agent/context/agent/runtime-context.md`

- [ ] **Step 1: Update README**

Replace tier docs with:

```md
## Capability model configuration

Chat model chains are configured directly per capability:

- `SHIRE_MODEL_DEFAULT`
- `SHIRE_MODEL_PRODUCT_QNA`
- `SHIRE_MODEL_ROLE_AWARE_CHAT`
- `SHIRE_MODEL_CV_NORMALIZATION`
- `SHIRE_MODEL_JOB_RERANK`
- `SHIRE_MODEL_TALENT_RERANK`
- `SHIRE_MODEL_RECOMMENDATION_EXPLANATION`
- `SHIRE_MODEL_WORKFLOW_SUMMARY`
- `SHIRE_MODEL_DISPUTE_SUMMARY`
- `SHIRE_MODEL_SECURITY_GUARD`

Embedding models are configured per retrieval surface:

- `SHIRE_EMBEDDING_MODEL_DEFAULT`
- `SHIRE_EMBEDDING_MODEL_MEMORY`
- `SHIRE_EMBEDDING_MODEL_PRODUCT_KNOWLEDGE`
- `SHIRE_EMBEDDING_MODEL_REPOSITORY_KNOWLEDGE`
```

- [ ] **Step 2: Update `.env.example`**

Add the env keys above with default OpenRouter-compatible values. Remove old
`SHIRE_MODEL_CHEAP`, `SHIRE_MODEL_BALANCED`, `SHIRE_MODEL_HEAVY`,
`SHIRE_EMBEDDING_MODEL`, and `SHIRE_EMBEDDING_BASE_URL` examples.

- [ ] **Step 3: Search docs for old tier names**

Run:

```powershell
rg "SHIRE_MODEL_CHEAP|SHIRE_MODEL_BALANCED|SHIRE_MODEL_HEAVY|cheap|balanced|heavy|SHIRE_EMBEDDING_MODEL|SHIRE_EMBEDDING_BASE_URL" apps/agent .agent/context/agent
```

Expected: old tier names only appear in historical docs under
`docs/superpowers/specs` or migration notes, not active runtime docs.

- [ ] **Step 4: Commit docs**

```powershell
git add -- apps/agent/README.md apps/agent/.env.example .agent/context/agent/runtime-context.md
git commit -m "docs(agent): document capability model env"
```

### Task 7: Full Verification

**Files:**
- No source edits unless verification finds a defect.

- [ ] **Step 1: Run full agent test suite**

Run:

```powershell
npm run test --workspace=@shire/agent
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run:

```powershell
npm run typecheck --workspace=@shire/agent
```

Expected: PASS.

- [ ] **Step 3: Run build**

Run:

```powershell
npm run build --workspace=@shire/agent
```

Expected: PASS.

- [ ] **Step 4: Final search for removed runtime concepts**

Run:

```powershell
rg "ModelTier|tierOverride|tier-override|modelChains\\.cheap|modelChains\\.balanced|modelChains\\.heavy|SHIRE_MODEL_CHEAP|SHIRE_MODEL_BALANCED|SHIRE_MODEL_HEAVY" apps/agent/src apps/agent/test apps/agent/README.md apps/agent/.env.example
```

Expected: no matches.

- [ ] **Step 5: Commit verification fixes if needed**

If any verification fixes were required:

```powershell
git add -- apps/agent
git commit -m "fix(agent): complete capability model routing migration"
```
