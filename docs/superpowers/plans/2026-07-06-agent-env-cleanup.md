# Agent Environment Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce the agent environment contract to canonical, runtime-active settings and make the local env files contain only meaningful deployment configuration.

**Architecture:** `createEnv()` remains the single production configuration boundary. Provider-specific aliases and direct `process.env` reads are removed, while active operational settings retain their current validation and defaults. Environment files become consumers of that canonical contract rather than a second source of defaults.

**Tech Stack:** TypeScript, Node.js test runner, Mastra, PowerShell

---

### Task 1: Lock the canonical environment contract with failing tests

**Files:**
- Modify: `apps/agent/test/env.test.ts`
- Test: `apps/agent/test/env.test.ts`

- [ ] **Step 1: Replace legacy/dead configuration assertions**

Remove the `liveLlmTestsEnabled`, `securityGuardEnabled`,
`securityGuardMode`, and `securityGuardModels` assertions. Replace the legacy
alias test and extend the security test with:

```ts
test("ignores legacy environment aliases", () => {
  const env = createEnv({
    DATABASE_URL: "postgresql://legacy.example/shire",
    TOKENROUTER_API_KEY: "legacy-text-key",
    OPENAI_API_KEY: "legacy-openai-key",
    OPENROUTER_API_KEY: "legacy-openrouter-key",
    SHIRE_MODEL_DEFAULT: "legacy/default",
    SHIRE_EMBEDDING_MODEL_DEFAULT: "legacy/embedding",
    SHIRE_EMBEDDING_BASE_URL_DEFAULT: "https://legacy.example/v1",
  });

  assert.equal(env.agentDatabaseUrl, undefined);
  assert.equal(env.textModelApiKey, undefined);
  assert.equal(env.embeddingApiKey, undefined);
  assert.equal(env.embeddingEnabled, false);
  assert.deepEqual(env.chatModelChains.default, ["MiniMax-M3"]);
  assert.equal(env.embeddingModels.default, "text-embedding-3-small");
  assert.equal(env.embeddingBaseUrls.default, "https://api.openai.com/v1");
});

test("exposes only active security configuration", () => {
  const env = createEnv({
    SHIRE_SECURITY_GUARD_ENABLED: "false",
    SHIRE_SECURITY_GUARD_MODE: "wide-open",
    SHIRE_SECURITY_GUARD_MODELS: "legacy/security",
    SHIRE_SECURITY_GUARD_THRESHOLD: "0.7",
  });

  assert.equal("securityGuardEnabled" in env, false);
  assert.equal("securityGuardMode" in env, false);
  assert.equal("securityGuardModels" in env, false);
  assert.equal(env.securityGuardThreshold, 0.7);
});
```

In the capability parsing test, prove non-runtime overrides are ignored:

```ts
const env = createEnv({
  SHIRE_TEXT_MODEL: "tokenrouter/default",
  SHIRE_MODEL_PRODUCT_QNA: "openrouter/product",
  SHIRE_MODEL_ROLE_AWARE_CHAT: "legacy/role-chat",
  SHIRE_MODEL_DISPUTE_SUMMARY: "legacy/dispute",
  SHIRE_TEXT_API_KEY: "text-key",
});

assert.deepEqual(env.chatModelChains.productQna, ["openrouter/product"]);
assert.deepEqual(env.chatModelChains.roleAwareChat, env.chatModelChains.default);
assert.deepEqual(env.chatModelChains.disputeSummary, env.chatModelChains.default);
```

Remove `SHIRE_LIVE_LLM_TESTS` and
`SHIRE_EMBEDDING_BASE_URL_DEFAULT` from the custom parsing test; use
`SHIRE_EMBEDDING_BASE_URL` for the latter.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
node --import tsx --test apps/agent/test/env.test.ts
```

Expected: FAIL because aliases still populate configuration, dead security
properties still exist, and dead capability overrides still change chains.

- [ ] **Step 3: Commit the failing contract test**

```powershell
git add -- apps/agent/test/env.test.ts
git commit -m "test(agent): define canonical env contract"
```

### Task 2: Make `createEnv()` canonical and remove dead configuration

**Files:**
- Modify: `apps/agent/src/env.ts`
- Test: `apps/agent/test/env.test.ts`

- [ ] **Step 1: Remove redundant and dead parsers**

Delete `parseRequiredModelChain()` and `parseSecurityGuardMode()`. Keep
`parseBoolean`, `parseModelChain`, `parseUnitInterval`,
`parsePositiveInteger`, and `normalizeBaseUrl`.

- [ ] **Step 2: Replace alias-based defaults with canonical inputs**

Use these exact initializers:

```ts
const defaultChatModels = parseModelChain(input.SHIRE_TEXT_MODEL, [
  "MiniMax-M3",
]);
const textBaseUrl =
  input.SHIRE_TEXT_BASE_URL?.trim() || "https://api.tokenrouter.com/v1";
const defaultEmbeddingModel =
  input.SHIRE_EMBEDDING_MODEL?.trim() || "text-embedding-3-small";
const defaultEmbeddingBaseUrl = normalizeBaseUrl(
  input.SHIRE_EMBEDDING_BASE_URL?.trim() || "https://api.openai.com/v1",
);
```

Replace database and credential resolution with:

```ts
agentDatabaseUrl:
  input.SHIRE_AGENT_DATABASE_URL?.trim() || undefined,
textModelApiKey:
  input.SHIRE_TEXT_API_KEY?.trim() || undefined,
embeddingApiKey:
  input.SHIRE_EMBEDDING_API_KEY?.trim() || undefined,
embeddingEnabled: parseBoolean(
  input.SHIRE_EMBEDDING_ENABLED,
  Boolean(input.SHIRE_EMBEDDING_API_KEY?.trim()),
),
```

Delete the outdated comment describing `DATABASE_URL` fallback.

- [ ] **Step 3: Keep only model overrides with production callers**

Use the default chain directly for unsupported overrides:

```ts
chatModelChains: {
  default: defaultChatModels,
  productQna: parseModelChain(
    input.SHIRE_MODEL_PRODUCT_QNA,
    defaultChatModels,
  ),
  roleAwareChat: defaultChatModels,
  cvNormalization: parseModelChain(
    input.SHIRE_MODEL_CV_NORMALIZATION,
    defaultChatModels,
  ),
  knowledgeSynthesis: defaultChatModels,
  jobRerank: parseModelChain(
    input.SHIRE_MODEL_JOB_RERANK,
    defaultChatModels,
  ),
  talentRerank: parseModelChain(
    input.SHIRE_MODEL_TALENT_RERANK,
    defaultChatModels,
  ),
  recommendationExplanation: defaultChatModels,
  workflowSummary: defaultChatModels,
  disputeSummary: defaultChatModels,
  securityGuard: parseModelChain(
    input.SHIRE_MODEL_SECURITY_GUARD,
    defaultChatModels,
  ),
},
```

- [ ] **Step 4: Remove dead return properties**

Delete:

```ts
liveLlmTestsEnabled
securityGuardEnabled
securityGuardMode
securityGuardModels
```

Keep `securityGuardThreshold`.

- [ ] **Step 5: Run the focused test and verify GREEN**

Run:

```powershell
node --import tsx --test apps/agent/test/env.test.ts
```

Expected: all tests in `env.test.ts` pass.

- [ ] **Step 6: Commit the canonical parser**

```powershell
git add -- apps/agent/src/env.ts
git commit -m "refactor(agent): canonicalize environment config"
```

### Task 3: Remove provider-specific credential reads

**Files:**
- Modify: `apps/agent/test/embeddings.test.ts`
- Modify: `apps/agent/src/runtime/models/embeddings.ts`
- Modify: `apps/agent/test/test-env.ts`
- Modify: `apps/agent/test/chat-agent.test.ts`
- Modify: `apps/agent/test/chat-stream.test.ts`
- Modify: `apps/agent/test/memory.test.ts`
- Modify: `apps/agent/test/live-cv-worker.test.ts`
- Modify: `apps/agent/test/package-scripts.test.ts`
- Test: `apps/agent/test/embeddings.test.ts`

- [ ] **Step 1: Add a failing ownership check**

Add these imports and test to `embeddings.test.ts`:

```ts
import { readFile } from "node:fs/promises";

test("reads embedding credentials only through canonical env config", async () => {
  const source = await readFile(
    new URL("../src/runtime/models/embeddings.ts", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(source, /process\.env\.(?:TOKENROUTER|OPENROUTER)_API_KEY/);
});
```

- [ ] **Step 2: Run the embedding test and verify RED**

Run:

```powershell
node --import tsx --test apps/agent/test/embeddings.test.ts
```

Expected: FAIL because `createEmbeddingModel()` still reads
`TOKENROUTER_API_KEY` and `OPENROUTER_API_KEY`.

- [ ] **Step 3: Remove direct fallback reads**

Replace the `apiKey` initializer in `createEmbeddingModel()` with:

```ts
apiKey: config.apiKey ?? env.embeddingApiKey,
```

- [ ] **Step 4: Update test fixtures to canonical names**

Apply these replacements:

```text
chat-agent.test.ts:
  OPENAI_API_KEY -> SHIRE_EMBEDDING_API_KEY
  TOKENROUTER_API_KEY -> SHIRE_TEXT_API_KEY

chat-stream.test.ts:
  TOKENROUTER_API_KEY -> SHIRE_TEXT_API_KEY

embeddings.test.ts:
  OPENAI_API_KEY -> SHIRE_EMBEDDING_API_KEY

memory.test.ts:
  OPENAI_API_KEY -> SHIRE_EMBEDDING_API_KEY

live-cv-worker.test.ts:
  hasKey = Boolean(process.env.SHIRE_TEXT_API_KEY)

package-scripts.test.ts:
  TOKENROUTER_API_KEY -> SHIRE_TEXT_API_KEY
```

Reduce `isolatedEnvironmentKeys` in `test-env.ts` to canonical configuration:

```ts
const isolatedEnvironmentKeys = [
  "REDIS_URL",
  "SHIRE_AGENT_DATABASE_URL",
  "SHIRE_TEXT_PROVIDER",
  "SHIRE_TEXT_BASE_URL",
  "SHIRE_TEXT_MODEL",
  "SHIRE_TEXT_API_KEY",
  "SHIRE_EMBEDDING_API_KEY",
  "SHIRE_AGENT_MEMORY_URL",
  "SHIRE_AGENT_MEMORY_AUTH_TOKEN",
  "SHIRE_AGENT_KNOWLEDGE_URL",
  "SHIRE_AGENT_KNOWLEDGE_AUTH_TOKEN",
  "SHIRE_AGENT_KNOWLEDGE_MANIFEST_URL",
  "SHIRE_AGENT_KNOWLEDGE_MANIFEST_AUTH_TOKEN",
] as const;
```

Keep direct `SHIRE_LIVE_LLM_TESTS=false` isolation because the live test owns
that opt-in independently of `createEnv()`.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```powershell
node --import tsx --test apps/agent/test/env.test.ts apps/agent/test/embeddings.test.ts apps/agent/test/chat-agent.test.ts apps/agent/test/chat-stream.test.ts apps/agent/test/memory.test.ts apps/agent/test/package-scripts.test.ts
```

Expected: all selected tests pass.

- [ ] **Step 6: Commit credential ownership cleanup**

```powershell
git add -- apps/agent/src/runtime/models/embeddings.ts apps/agent/test/test-env.ts apps/agent/test/chat-agent.test.ts apps/agent/test/chat-stream.test.ts apps/agent/test/embeddings.test.ts apps/agent/test/memory.test.ts apps/agent/test/live-cv-worker.test.ts apps/agent/test/package-scripts.test.ts
git commit -m "refactor(agent): remove provider env fallbacks"
```

### Task 4: Minimize `.env` and rebuild `.env.example`

**Files:**
- Modify: `apps/agent/.env`
- Modify: `apps/agent/.env.example`

- [ ] **Step 1: Reduce the local `.env` allowlist**

Preserve the current values only for these keys:

```text
REDIS_URL
SHIRE_AGENT_SERVICE_TOKEN
SHIRE_AGENT_DATABASE_URL
SHIRE_TEXT_PROVIDER
SHIRE_TEXT_MODEL
SHIRE_TEXT_BASE_URL
SHIRE_TEXT_API_KEY
SHIRE_EMBEDDING_PROVIDER
SHIRE_EMBEDDING_MODEL
SHIRE_EMBEDDING_BASE_URL
SHIRE_EMBEDDING_API_KEY
SHIRE_EMBEDDING_ENABLED
SHIRE_WORKING_MEMORY_ENABLED
SHIRE_AGENT_MEMORY_URL
SHIRE_AGENT_MEMORY_AUTH_TOKEN
SHIRE_AGENT_KNOWLEDGE_URL
SHIRE_AGENT_KNOWLEDGE_AUTH_TOKEN
SHIRE_AGENT_KNOWLEDGE_INDEX
```

Delete every other active assignment. The manifest URL and token are omitted
because their current values equal the knowledge URL and token, and
`createEnv()` already derives them.

- [ ] **Step 2: Replace `.env.example` with canonical active examples**

Use this active section:

```dotenv
REDIS_URL=rediss://user:password@redis.example.com:6379
SHIRE_AGENT_SERVICE_TOKEN=replace-with-a-long-random-secret
SHIRE_AGENT_DATABASE_URL=postgresql://user:password@host:5432/shire

SHIRE_TEXT_PROVIDER=tokenrouter
SHIRE_TEXT_MODEL=MiniMax-M3
SHIRE_TEXT_BASE_URL=https://api.tokenrouter.com/v1
SHIRE_TEXT_API_KEY=

SHIRE_EMBEDDING_PROVIDER=openai
SHIRE_EMBEDDING_MODEL=text-embedding-3-small
SHIRE_EMBEDDING_BASE_URL=https://api.openai.com/v1
SHIRE_EMBEDDING_API_KEY=
SHIRE_EMBEDDING_ENABLED=false
SHIRE_WORKING_MEMORY_ENABLED=false

SHIRE_AGENT_MEMORY_URL=file:./.data/shire-agent-memory.db
SHIRE_AGENT_MEMORY_AUTH_TOKEN=
SHIRE_AGENT_KNOWLEDGE_URL=file:./.data/shire-agent-knowledge.db
SHIRE_AGENT_KNOWLEDGE_AUTH_TOKEN=
SHIRE_AGENT_KNOWLEDGE_INDEX=shire_context
```

Document only active optional knobs as commented assignments:

```dotenv
# NODE_ENV=production
# PORT=3010
# SHIRE_JOB_QUEUE_NAME=shire-agent-jobs
# SHIRE_JOB_ATTEMPTS=3
# SHIRE_JOB_BACKOFF_MS=5000
# SHIRE_CV_MAX_FILE_BYTES=5242880
# SHIRE_AUTONOMY_MODE=semi-autonomous
# SHIRE_LOG_LEVEL=info
# SHIRE_PRETTY_LOGS=false
# SHIRE_MODEL_PRODUCT_QNA=
# SHIRE_MODEL_CV_NORMALIZATION=
# SHIRE_MODEL_JOB_RERANK=
# SHIRE_MODEL_TALENT_RERANK=
# SHIRE_MODEL_SECURITY_GUARD=
# SHIRE_EMBEDDING_MODEL_MEMORY=
# SHIRE_EMBEDDING_MODEL_PRODUCT_KNOWLEDGE=
# SHIRE_EMBEDDING_MODEL_REPOSITORY_KNOWLEDGE=
# SHIRE_EMBEDDING_BASE_URL_MEMORY=
# SHIRE_EMBEDDING_BASE_URL_PRODUCT_KNOWLEDGE=
# SHIRE_EMBEDDING_BASE_URL_REPOSITORY_KNOWLEDGE=
# SHIRE_WORKER_ENABLED=true
# SHIRE_RECOMMENDATION_SCHEDULER_ENABLED=true
# SHIRE_RECOMMENDATION_SCHEDULER_INTERVAL_MS=900000
# SHIRE_CHAT_MAX_BODY_BYTES=65536
# SHIRE_CHAT_MAX_MESSAGES=50
# SHIRE_CHAT_MAX_MESSAGE_CHARACTERS=8000
# SHIRE_CHAT_RATE_LIMIT_REQUESTS=30
# SHIRE_CHAT_RATE_LIMIT_WINDOW_SECONDS=60
# SHIRE_SECURITY_GUARD_THRESHOLD=0.85
# SHIRE_OUTPUT_MAX_CHARACTERS=12000
# SHIRE_AGENT_KNOWLEDGE_MANIFEST_URL=
# SHIRE_AGENT_KNOWLEDGE_MANIFEST_AUTH_TOKEN=
# SHIRE_RAG_TOP_K=5
# SHIRE_RAG_MAX_CHARACTERS=8000
```

- [ ] **Step 3: Run a static active-key audit**

Run:

```powershell
$source = Get-Content -Raw apps/agent/src/env.ts
foreach ($path in @("apps/agent/.env", "apps/agent/.env.example")) {
  $keys = Get-Content $path | ForEach-Object {
    if ($_ -match "^\s*([A-Z][A-Z0-9_]*)\s*=") { $matches[1] }
  }
  $unused = @($keys | Where-Object { $source -notmatch "input\.$_" })
  if ($unused.Count) { throw "$path has unused keys: $($unused -join ', ')" }
}
```

Expected: exit 0 with no unused active keys.

- [ ] **Step 4: Commit the tracked example**

`.env` is intentionally untracked. Commit only the example:

```powershell
git add -- apps/agent/.env.example
git commit -m "chore(agent): minimize environment examples"
```

### Task 5: Align documentation and verify the full agent

**Files:**
- Modify: `apps/agent/README.md`
- Test: `apps/agent/test/index.ts`

- [ ] **Step 1: Update the README environment contract**

Remove claims that canonical credentials fall back to provider-specific keys.
Replace them with:

```md
`SHIRE_TEXT_API_KEY` and `SHIRE_EMBEDDING_API_KEY` are the only accepted
credential variables. Provider-specific aliases are intentionally unsupported
so deployment order cannot silently select a different credential.
```

Limit the capability override list to:

```md
- `SHIRE_MODEL_PRODUCT_QNA`
- `SHIRE_MODEL_CV_NORMALIZATION`
- `SHIRE_MODEL_JOB_RERANK`
- `SHIRE_MODEL_TALENT_RERANK`
- `SHIRE_MODEL_SECURITY_GUARD`
```

Change live-test requirements to `SHIRE_TEXT_API_KEY` only. State that
`SHIRE_LIVE_LLM_TESTS=true` is supplied explicitly when running the live test
and is not a production runtime setting.

- [ ] **Step 2: Run the complete agent test suite**

Run:

```powershell
npm.cmd run test --workspace=@shire/agent
```

Expected: exit 0, no failed tests.

- [ ] **Step 3: Run typecheck and build**

Run:

```powershell
npm.cmd run typecheck --workspace=@shire/agent
npm.cmd run build --workspace=@shire/agent
```

Expected: both commands exit 0.

- [ ] **Step 4: Verify removed configuration is absent**

Run:

```powershell
rg -n "SHIRE_SECURITY_GUARD_(ENABLED|MODE|MODELS)|SHIRE_MODEL_DEFAULT|SHIRE_EMBEDDING_(MODEL|BASE_URL)_DEFAULT|input\.(TOKENROUTER_API_KEY|OPENAI_API_KEY|OPENROUTER_API_KEY|DATABASE_URL)|process\.env\.(TOKENROUTER_API_KEY|OPENROUTER_API_KEY)" apps/agent/src apps/agent/.env.example
```

Expected: no matches.

- [ ] **Step 5: Commit documentation and final test adjustments**

```powershell
git add -- apps/agent/README.md
git commit -m "docs(agent): document canonical env variables"
```

- [ ] **Step 6: Inspect final scope**

Run:

```powershell
git status --short
git diff --check
```

Expected: only the intentionally untracked local `.env` modification remains;
`git diff --check` exits 0.
