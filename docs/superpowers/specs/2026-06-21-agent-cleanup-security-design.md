# Agent Cleanup & Security Hardening — Design

> Scope: `apps/agent` only. No changes to `apps/web`, `contracts`, or new data layer.

## Goal

Make `apps/agent` clean, honest, and production-ready as it stands today — without
implementing features that depend on a data layer that does not exist yet.

The agent service must run, type-check, and keep all 212 tests green. What it runs
must match what it advertises.

## Problems being addressed (from architecture audit)

1. **`server.ts` is 689 lines** mixing bootstrap, dependency wiring, four route
   handlers, three `app.use` middleware chains, and CLI dispatch. Hard to read,
   hard to test in isolation.
2. **Workflow placeholders mislead readers.** `job-matching.workflow.ts` and
   `talent-matching.workflow.ts` compute `score = string.length / 10` and return
   a canned summary. They are registered in the Mastra index as if real, but the
   real CV path runs through `cv-parse.processor` (BullMQ), not the workflow.
3. **Dead security configuration.** `SHIRE_SECURITY_GUARD_MODELS` and
   `SHIRE_SECURITY_GUARD_THRESHOLD` are parsed in `env.ts`, but
   `guardSecurityPrompt()` only runs regex — it never calls an LLM. The configured
   models and threshold are inert.
4. **`/health` and `/ready` are identical.** `/ready` should fail when dependencies
   (Redis/libSQL) are unreachable; `/health` only asserts the process is alive.

## Out of scope

- ❌ Real matching algorithm (Filter → Rule Score → Rerank). Needs Prisma/Postgres
  (Phase 1-7 in `tasks.md`). Tracked separately.
- ❌ Migrating chat middleware off Express onto Mastra `server.middleware`. The
  middleware relies on a module-level `rateLimiter` instance and mutates
  `request.body`; migrating to Hono context is high-risk for 212 tests and offers
  no functional gain. The middleware stays in Express but gets extracted into
  focused modules.
- ❌ Deleting workflow files. Tests assert their `.id`; removing them widens scope
  for no production benefit. They get labeled as honest stubs instead.
- ❌ Prisma/Postgres, `apps/web`, `contracts`, endpoint contract changes.

## Changes

### 1. Split `server.ts` into focused modules

Move route handlers and the chat middleware out of `server.ts` into a `routes/`
package, keeping `createRuntimeHttpServer` as the thin composition root and
preserving its exported signature and `RuntimeHttpServerDependencies` type.

New layout:
```
src/
  server.ts                       # composition root (thin): wiring + listen + bootstrap
  routes/
    chat.middleware.ts            # auth + validation + rate-limit + security + RAG (Express app.use chain)
    jobs.route.ts                 # POST /jobs, GET /jobs/:jobId, POST /jobs/cv-document
    product-qna.route.ts          # POST /product-qna
    health.route.ts               # GET /health, GET /ready (now distinct)
```

`createRuntimeHttpServer`, `RuntimeHttpServerDependencies`, `getRuntimeBootstrapOutput`,
`runServer`, `startRuntimeService` keep their names and shapes. Tests import these
unchanged.

### 2. Label workflow placeholders honestly

Add a prominent header comment to the three workflow files declaring them stubs:
```ts
// STUB — deterministic placeholder workflow.
// Real matching pipeline (Filter → Rule Score → Rerank) is pending Phase 6-7
// and depends on a Prisma data layer that does not exist yet.
// The CV path that actually runs is cv-parse.processor via BullMQ.
```

No behavioral change. Tests keep passing. The placeholder is now visible to any
reader instead of disguised as a real implementation.

### 3. Wire the LLM security guard

`guardSecurityPrompt` becomes async and gains an LLM confirmation step for
"suspicious" inputs (the regex layer stays as the fast first pass):

- Fast regex pass (`classifySecurityIndicator`) — unchanged, synchronous.
- When `level === "suspicious"`, call the configured `security-guard` capability
  model via the existing `resolveModelChain`. The LLM returns a structured risk
  verdict. `SHIRE_SECURITY_GUARD_THRESHOLD` now actually gates the decision.
- If the LLM call fails, fall back to the regex-based `guardSecurityPrompt`
  result so the path degrades safely (never blocks on provider outage in a way
  that disables all protection).

The existing `securityGuard` dependency-injection seam in
`RuntimeHttpServerDependencies` is extended to accept the async signature.

### 4. Differentiate `/health` and `/ready`

- `/health` → always 200 with bootstrap output (process alive).
- `/ready` → 200 with bootstrap output when dependencies are reachable, 503
  `{ status: "not-ready", ... }` when a required dependency (Redis when
  `REDIS_URL` set, or libSQL stores) cannot be reached. Reachability probe is a
  lightweight ping that fails fast.

## Testing strategy

- Every existing test stays green. Dependency-injection seams are preserved so
  the LLM guard, rate limiter, and knowledge search remain mockable.
- New unit tests: `/ready` returns 503 when a dependency probe fails;
  `/ready` returns 200 when probes pass.
- LLM guard: unit test with a mocked model-router returning a structured verdict;
  fallback-to-regex path covered when the model throws.

## Risk

- **Medium** — splitting `server.ts`: must preserve the exact middleware ordering
  (auth → logging → validation → rate-limit → security → RAG) and the shared
  module-level `rateLimiter`/`processor` instances. Mitigated by keeping
  `createRuntimeHttpServer` as the single composition point that constructs and
  passes these into the route modules.
- **Low** — LLM guard adds one model call to the chat path, but only for
  "suspicious" inputs (same gating as today). Synchronous regex path unchanged.

## Branch & commits

Branch `agent-refactor` (from `feat/persistent-agent-memory-storage`).

Granular commits:
1. docs: spec
2. refactor(server): split server.ts into route modules
3. chore(agent): label workflow placeholders as stubs
4. feat(agent): wire LLM security guard to capability routing
5. feat(agent): differentiate /health and /ready

No endpoint contract changes. Response shapes preserved.
