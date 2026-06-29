# Full-Stack Agent Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect every authenticated Shire page to real database and agent flows, deduplicate matching by candidate-job input version, and make chat and Product Q&A reliable, cancellable, and testable.

**Architecture:** The browser calls only authenticated `apps/web` routes. Web owns authorization and trusted Postgres context, while `apps/agent` owns model, matching, memory, and RAG execution. Matching uses one canonical persisted evaluation per candidate-job pair and a deterministic queue key; demo fixtures remain available only to landing-page components.

**Tech Stack:** TypeScript, Next.js App Router, React, TanStack Query, Express, Mastra, Vercel AI SDK v6, Drizzle ORM, PostgreSQL, BullMQ, Redis, libSQL/Turso, Node test runner.

**Design:** `docs/superpowers/specs/2026-06-29-full-stack-agent-integration-design.md`

---

## Execution Rules

- Execute tasks in order. Each task must leave the repository buildable.
- Use red-green-refactor for every behavior change.
- Do not load `.env` in default tests.
- Do not call live Redis, Postgres, Turso, embeddings, or text providers in default tests.
- Commit only the files listed in the active task.
- Do not import `apps/web/lib/seed.ts`, `apps/web/lib/dashboard-data.ts`, or domain data from `apps/web/store` in authenticated application code.

### Task 1: Isolate Agent Tests From Live Infrastructure

**Files:**
- Create: `apps/agent/test/test-env.ts`
- Modify: `apps/agent/test/index.ts`
- Modify: `apps/agent/src/types/runtime.ts`
- Modify: `apps/agent/src/server.ts`
- Modify: `apps/agent/test/server.test.ts`
- Test: `apps/agent/test/server.test.ts`
- Test: `apps/agent/test/package-scripts.test.ts`

- [ ] **Step 1: Write a failing test proving server tests do not construct a live runtime**

Add a deterministic runtime dependency in `server.test.ts`:

```ts
import { InMemoryJobQueue } from "../src/runtime/jobs/in-memory-job-queue";

function createTestRuntimeDependencies() {
  return {
    jobQueue: new InMemoryJobQueue(),
    serviceToken: CHAT_SERVICE_TOKEN,
    mountAgentChat(app: import("express").Express) {
      app.post("/chat/:agentId", (_request, response) => {
        response
          .status(200)
          .set("content-type", "text/event-stream")
          .send(
            [
              'data: {"type":"start","messageId":"test"}',
              'data: {"type":"text-start","id":"txt-0"}',
              'data: {"type":"text-delta","id":"txt-0","delta":"Test answer"}',
              'data: {"type":"text-end","id":"txt-0"}',
              'data: {"type":"finish"}',
              "data: [DONE]",
              "",
            ].join("\n\n"),
          );
      });
    },
  };
}

test("test server uses injected chat runtime without live providers", async () => {
  const { server, url } = await startTestServer(createTestRuntimeDependencies());
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: chatHeaders(),
      body: JSON.stringify(createChatBody("candidate", "How does Shire work?")),
    });
    assert.equal(response.status, 200);
    assert.match(await response.text(), /Test answer/);
  } finally {
    await stopTestServer(server);
  }
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
node --import tsx --test apps/agent/test/server.test.ts
```

Expected: FAIL because `mountAgentChat` is not part of
`RuntimeHttpServerDependencies`.

- [ ] **Step 3: Add explicit runtime injection and a sanitized test environment**

Add this dependency to `apps/agent/src/types/runtime.ts`:

```ts
import type { Express } from "express";

export type RuntimeHttpServerDependencies = {
  // Preserve the existing fields.
  mountAgentChat?: (app: Express) => void | Promise<void>;
};
```

In `createRuntimeHttpServer`, mount either the injected chat handler or Mastra:

```ts
if (dependencies.mountAgentChat) {
  await dependencies.mountAgentChat(app);
} else {
  const server = new MastraServer({ app, mastra });
  await server.init();
}
```

Create `apps/agent/test/test-env.ts`:

```ts
const blockedKeys = [
  "REDIS_URL",
  "SHIRE_AGENT_DATABASE_URL",
  "SHIRE_TEXT_API_KEY",
  "TOKENROUTER_API_KEY",
  "OPENROUTER_API_KEY",
  "SHIRE_EMBEDDING_API_KEY",
  "SHIRE_AGENT_MEMORY_URL",
  "SHIRE_AGENT_MEMORY_AUTH_TOKEN",
  "SHIRE_AGENT_KNOWLEDGE_URL",
  "SHIRE_AGENT_KNOWLEDGE_AUTH_TOKEN",
] as const;

for (const key of blockedKeys) {
  delete process.env[key];
}

process.env.SHIRE_WORKER_ENABLED = "false";
process.env.SHIRE_RECOMMENDATION_SCHEDULER_ENABLED = "false";
process.env.SHIRE_EMBEDDING_ENABLED = "false";
process.env.SHIRE_LIVE_LLM_TESTS = "false";
```

Import it first in `apps/agent/test/index.ts`:

```ts
await import("./test-env");
```

Remove the test-only assignment that creates a fake live TokenRouter key.
Ensure every server test uses `createTestRuntimeDependencies()`.

- [ ] **Step 4: Verify GREEN and confirm no live infrastructure logs**

Run:

```powershell
npm.cmd run test --workspace=@shire/agent
```

Expected: PASS with no Upstash, Turso, embedding, or model-provider request.

- [ ] **Step 5: Commit**

```powershell
git add -- apps/agent/test/test-env.ts apps/agent/test/index.ts apps/agent/src/types/runtime.ts apps/agent/src/server.ts apps/agent/test/server.test.ts apps/agent/test/package-scripts.test.ts
git commit -m "test(agent): isolate default suite from live services"
```

### Task 2: Resolve Dynamic Page-Aware Chat Context

**Files:**
- Modify: `apps/web/components/ai/chat-shell.tsx`
- Modify: `apps/web/lib/chat/context.ts`
- Modify: `apps/web/lib/chat/server-scope.ts`
- Modify: `apps/web/app/api/chat/[scope]/route.ts`
- Modify: `apps/web/lib/server/jobs-repository.ts`
- Modify: `apps/web/lib/server/applications-repository.ts`
- Test: `apps/web/test/chat-thread.test.ts`
- Test: `apps/web/test/chat-route.test.ts`

- [ ] **Step 1: Write failing client scope tests for arbitrary UUID jobs**

```ts
test("candidate job pages send the real job id without a demo catalog", () => {
  assert.deepEqual(
    resolveChatScopeForPathname({
      pathname: "/candidate/jobs/6a9f3157-88c4-4d2d-868e-584645a76a72",
      role: "candidate",
    }),
    {
      role: "candidate",
      resourceType: "job",
      resourceId: "6a9f3157-88c4-4d2d-868e-584645a76a72",
    },
  );
});

test("recruiter job pages send the real owned job id", () => {
  assert.equal(
    resolveChatScopeForPathname({
      pathname: "/recruiter/jobs/job-real-1",
      role: "recruiter",
    }).resourceId,
    "job-real-1",
  );
});
```

- [ ] **Step 2: Run client scope tests and verify RED**

Run:

```powershell
node --import tsx --test apps/web/test/chat-thread.test.ts
```

Expected: FAIL because arbitrary job IDs currently produce general scope.

- [ ] **Step 3: Remove the demo catalog from client scope resolution**

Implement route-only scope extraction:

```ts
const jobMatch = input.pathname.match(
  input.role === "candidate"
    ? /^\/candidate\/jobs\/([^/]+)$/
    : /^\/recruiter\/jobs\/([^/]+)$/,
);

if (jobMatch?.[1]) {
  return buildServerChatScopeRequest({
    role: input.role,
    resourceType: "job",
    resourceId: decodeURIComponent(jobMatch[1]),
  });
}
```

Remove the unused `jobs` argument and pass only `role` and `pathname` from
`ChatShell`.

- [ ] **Step 4: Write failing server authorization tests**

```ts
test("recruiter can chat about an owned job", async () => {
  const job = await jobs.createJob(recruiter.id, validJobDraft);
  const response = await handler(
    chatRequest({
      role: "recruiter",
      resourceType: "job",
      resourceId: job.id,
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(forwarded.scope.resourceLabel, validJobDraft.title);
});

test("recruiter cannot chat about another recruiter's job", async () => {
  const response = await handler(
    chatRequest({
      role: "recruiter",
      resourceType: "job",
      resourceId: foreignJob.id,
    }),
  );
  assert.equal(response.status, 403);
});
```

- [ ] **Step 5: Run server chat tests and verify RED**

Run:

```powershell
node --import tsx --test apps/web/test/chat-route.test.ts
```

Expected: FAIL because `server-scope.ts` authorizes only demo candidate jobs and
does not authorize recruiter jobs.

- [ ] **Step 6: Make trusted scope resolution asynchronous and repository-backed**

Replace `visibleDemoJob()` with:

```ts
export type ChatResourceRepository = {
  getJob(id: string): Promise<{
    id: string;
    recruiterUserId: string;
    title: string;
    description: string;
    companyName: string;
    status: string;
    skillsRequired: string[];
  } | null>;
};
```

Resolve candidate jobs only when active and recruiter jobs only when owned.
Build trusted resource context from the fetched row. Do not use a browser label.
Map missing rows to 404 and ownership failures to 403.

- [ ] **Step 7: Verify chat regressions**

Run:

```powershell
node --import tsx --test apps/web/test/chat-thread.test.ts apps/web/test/chat-route.test.ts
npm.cmd run typecheck --workspace=@shire/web
```

Expected: all selected tests and typecheck PASS.

- [ ] **Step 8: Commit**

```powershell
git add -- apps/web/components/ai/chat-shell.tsx apps/web/lib/chat/context.ts apps/web/lib/chat/server-scope.ts apps/web/app/api/chat/[scope]/route.ts apps/web/lib/server/jobs-repository.ts apps/web/lib/server/applications-repository.ts apps/web/test/chat-thread.test.ts apps/web/test/chat-route.test.ts
git commit -m "fix(web): authorize dynamic page-aware chat context"
```

### Task 3: Add Canonical Matching Evaluation Storage

**Files:**
- Modify: `packages/shared/src/matching.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `apps/web/lib/server/db/schema.ts`
- Modify: `apps/agent/src/runtime/db/schema.ts`
- Create: `apps/web/drizzle/0003_matching_evaluations.sql`
- Modify: `apps/agent/src/runtime/matching/types.ts`
- Test: `apps/agent/test/job-contracts.test.ts`
- Test: `apps/agent/test/matching-pipeline.test.ts`

- [ ] **Step 1: Write failing shared contract tests**

```ts
test("matching evaluation statuses are stable across web and agent", () => {
  assert.deepEqual(MATCHING_EVALUATION_STATUSES, [
    "PENDING",
    "RUNNING",
    "COMPLETED",
    "FAILED",
  ]);
  assert.equal(MATCHING_SCORING_VERSION.length > 0, true);
});
```

- [ ] **Step 2: Run and verify RED**

```powershell
node --import tsx --test apps/agent/test/job-contracts.test.ts
```

Expected: FAIL because the shared constants do not exist.

- [ ] **Step 3: Add shared evaluation constants and schema**

Add to `packages/shared/src/matching.ts`:

```ts
export const MATCHING_EVALUATION_STATUSES = [
  "PENDING",
  "RUNNING",
  "COMPLETED",
  "FAILED",
] as const;

export type MatchingEvaluationStatus =
  (typeof MATCHING_EVALUATION_STATUSES)[number];

export const MATCHING_SCORING_VERSION = "matching-v1";
```

Add `matchingEvaluations` to both Drizzle schemas with:

```ts
export const matchingEvaluations = pgTable(
  "matching_evaluations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    candidateUserId: uuid("candidate_user_id").notNull(),
    jobId: uuid("job_id").notNull(),
    inputHash: text("input_hash").notNull(),
    scoringVersion: text("scoring_version").notNull(),
    status: text("status").notNull(),
    ruleScore: integer("rule_score"),
    matchScore: integer("match_score"),
    confidence: numeric("confidence", { precision: 3, scale: 2 }),
    recommendedAction: text("recommended_action"),
    reasons: jsonb("reasons").$type<string[]>().default([]).notNull(),
    missingRequirements: jsonb("missing_requirements")
      .$type<string[]>()
      .default([])
      .notNull(),
    riskFlags: jsonb("risk_flags").$type<string[]>().default([]).notNull(),
    failureCode: text("failure_code"),
    attemptCount: integer("attempt_count").default(0).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("matching_evaluations_candidate_job_unique").on(
      table.candidateUserId,
      table.jobId,
    ),
  ],
);
```

The migration must add foreign keys, indexes for `status` and `updated_at`, and
RLS with no direct anon/authenticated grants.

- [ ] **Step 4: Generate and inspect migration**

Run:

```powershell
npm.cmd run db:generate --workspace=@shire/web
```

Expected: one migration containing `matching_evaluations` and its unique index.
If Drizzle chooses a number other than `0003`, keep the generated number and
update the plan tracking note.

- [ ] **Step 5: Verify schema parity**

Run:

```powershell
npm.cmd run typecheck --workspace=@shire/web
npm.cmd run typecheck --workspace=@shire/agent
```

Expected: both PASS.

- [ ] **Step 6: Commit**

```powershell
git add -- packages/shared/src/matching.ts packages/shared/src/index.ts apps/web/lib/server/db/schema.ts apps/agent/src/runtime/db/schema.ts apps/web/drizzle apps/agent/src/runtime/matching/types.ts apps/agent/test/job-contracts.test.ts apps/agent/test/matching-pipeline.test.ts
git commit -m "feat(matching): add canonical pair evaluation storage"
```

### Task 4: Evaluate Each Candidate-Job Pair Once

**Files:**
- Create: `apps/agent/src/runtime/matching/fingerprint.ts`
- Create: `apps/agent/src/runtime/matching/evaluation.ts`
- Modify: `apps/agent/src/runtime/matching/types.ts`
- Modify: `apps/agent/src/runtime/matching/repository.ts`
- Modify: `apps/agent/src/runtime/matching/pipeline.ts`
- Modify: `apps/agent/src/runtime/jobs/matching.processor.ts`
- Test: `apps/agent/test/matching-pipeline.test.ts`
- Create: `apps/agent/test/matching-fingerprint.test.ts`
- Modify: `apps/agent/test/index.ts`

- [ ] **Step 1: Write failing fingerprint tests**

```ts
test("matching fingerprint is stable for equivalent normalized input", () => {
  const first = createMatchingFingerprint(candidate, job);
  const second = createMatchingFingerprint(
    { ...candidate, skills: [...candidate.skills].reverse() },
    { ...job, skillsRequired: [...job.skillsRequired].reverse() },
  );
  assert.equal(first, second);
});

test("matching fingerprint changes when relevant job data changes", () => {
  assert.notEqual(
    createMatchingFingerprint(candidate, job),
    createMatchingFingerprint(candidate, {
      ...job,
      experienceLevel: "LEAD",
    }),
  );
});
```

- [ ] **Step 2: Run and verify RED**

```powershell
node --import tsx --test apps/agent/test/matching-fingerprint.test.ts
```

Expected: FAIL because `createMatchingFingerprint` does not exist.

- [ ] **Step 3: Implement canonical hashing**

Use `createHash("sha256")`, sorted string arrays, trimmed strings, explicit
booleans, and `MATCHING_SCORING_VERSION`. Do not hash timestamps or fields that
do not affect scoring.

- [ ] **Step 4: Write failing pair evaluation tests**

```ts
test("completed unchanged pairs skip reranking", async () => {
  repository.seedEvaluation({
    candidateUserId: candidate.userId,
    jobId: job.id,
    inputHash: createMatchingFingerprint(candidate, job),
    status: "COMPLETED",
  });
  let rerankCalls = 0;

  const result = await evaluateMatchingPair(repository, {
    candidateUserId: candidate.userId,
    jobId: job.id,
  }, {
    rerank: async () => {
      rerankCalls += 1;
      throw new Error("must not run");
    },
  });

  assert.equal(result.status, "unchanged");
  assert.equal(rerankCalls, 0);
});

test("below-threshold pairs are persisted and skipped next time", async () => {
  const first = await evaluateMatchingPair(repository, pair);
  const second = await evaluateMatchingPair(repository, pair);
  assert.equal(first.status, "completed");
  assert.equal(first.recommended, false);
  assert.equal(second.status, "unchanged");
});
```

- [ ] **Step 5: Run pair tests and verify RED**

```powershell
node --import tsx --test apps/agent/test/matching-pipeline.test.ts
```

Expected: FAIL because the existing pipelines do not persist negative
evaluations or compare fingerprints.

- [ ] **Step 6: Implement atomic evaluation lifecycle**

Add repository methods:

```ts
type MatchingEvaluationRepository = {
  getEvaluation(candidateUserId: string, jobId: string): Promise<MatchingEvaluation | null>;
  claimEvaluation(input: MatchingEvaluationClaim): Promise<"claimed" | "unchanged" | "busy">;
  completeEvaluation(input: MatchingEvaluationCompletion): Promise<void>;
  failEvaluation(input: MatchingEvaluationFailure): Promise<void>;
  deactivateIneligiblePairs(activePairs: Set<string>): Promise<number>;
};
```

`evaluateMatchingPair` must:

1. Load the confirmed candidate and active job.
2. Compute the fingerprint.
3. Atomically claim only missing, failed-retryable, or changed input.
4. Run rule score and optional rerank once.
5. Persist the evaluation, including negative outcomes.
6. Upsert both audience recommendation rows when eligible.
7. Remove or dismiss both recommendation rows when no longer eligible.

Use `onConflictDoUpdate` instead of read-then-insert for recommendations.

- [ ] **Step 7: Verify focused and full agent tests**

```powershell
node --import tsx --test apps/agent/test/matching-fingerprint.test.ts apps/agent/test/matching-pipeline.test.ts
npm.cmd run test --workspace=@shire/agent
```

Expected: PASS with no live service access.

- [ ] **Step 8: Commit**

```powershell
git add -- apps/agent/src/runtime/matching/fingerprint.ts apps/agent/src/runtime/matching/evaluation.ts apps/agent/src/runtime/matching/types.ts apps/agent/src/runtime/matching/repository.ts apps/agent/src/runtime/matching/pipeline.ts apps/agent/src/runtime/jobs/matching.processor.ts apps/agent/test/matching-pipeline.test.ts apps/agent/test/matching-fingerprint.test.ts apps/agent/test/index.ts
git commit -m "feat(agent): evaluate matching pairs incrementally"
```

### Task 5: Deduplicate Scheduler and Queue Work

**Files:**
- Modify: `apps/agent/src/runtime/jobs/job-contracts.ts`
- Modify: `apps/agent/src/runtime/jobs/job-queue.ts`
- Modify: `apps/agent/src/runtime/jobs/in-memory-job-queue.ts`
- Modify: `apps/agent/src/runtime/jobs/bullmq-job-queue.ts`
- Modify: `apps/agent/src/runtime/jobs/recommendation-scheduler.ts`
- Modify: `apps/agent/src/runtime/server/job-services.ts`
- Modify: `apps/agent/src/routes/jobs.route.ts`
- Test: `apps/agent/test/in-memory-job-queue.test.ts`
- Test: `apps/agent/test/bullmq-job-queue.test.ts`
- Test: `apps/agent/test/recommendation-scheduler.test.ts`

- [ ] **Step 1: Write failing queue dedup tests**

```ts
test("in-memory queue returns the existing job for one deduplication key", async () => {
  const queue = new InMemoryJobQueue();
  const request = {
    name: "matching-pair" as const,
    payload: { candidateId: "c1", jobId: "j1", inputHash: "hash-1" },
    deduplicationKey: "matching:c1:j1:hash-1",
  };
  const first = await queue.enqueue(request);
  const second = await queue.enqueue(request);
  assert.equal(second.id, first.id);
});

test("BullMQ receives the deterministic job id", async () => {
  assert.deepEqual(createBullJobOptions({
    attempts: 3,
    backoffMs: 5000,
    jobId: "matching:c1:j1:hash-1",
  }).jobId, "matching:c1:j1:hash-1");
});
```

- [ ] **Step 2: Run and verify RED**

```powershell
node --import tsx --test apps/agent/test/in-memory-job-queue.test.ts apps/agent/test/bullmq-job-queue.test.ts
```

Expected: FAIL because queue requests do not have deduplication keys.

- [ ] **Step 3: Implement queue-level idempotency**

Extend `JobRequest` with optional `deduplicationKey`. In-memory queue keeps a
map from key to job ID. BullMQ passes the key as `JobsOptions.jobId`.

Do not remove completed matching jobs immediately; their deterministic ID is the
queue-level duplicate guard for that input version.

- [ ] **Step 4: Write failing reconciliation scheduler test**

```ts
test("second reconciliation enqueues zero unchanged pairs", async () => {
  const first = await scheduler.runOnce();
  const second = await scheduler.runOnce();
  assert.deepEqual(first, { status: "queued", pairJobs: 2, skipped: 0 });
  assert.deepEqual(second, { status: "queued", pairJobs: 0, skipped: 2 });
});
```

- [ ] **Step 5: Run and verify RED**

```powershell
node --import tsx --test apps/agent/test/recommendation-scheduler.test.ts
```

Expected: FAIL because the scheduler enqueues one candidate job and one talent
job on every interval.

- [ ] **Step 6: Replace two-direction scheduling with pair reconciliation**

The scheduler discovers pair descriptors and asks the repository which hashes
need work. It enqueues one `matching-pair` job per stale pair:

```ts
await enqueue({
  name: "matching-pair",
  payload: {
    candidateId: pair.candidateUserId,
    jobId: pair.jobId,
    inputHash: pair.inputHash,
  },
  deduplicationKey:
    `matching:${pair.candidateUserId}:${pair.jobId}:${pair.inputHash}`,
});
```

Keep manual job-matching and talent-matching CLI commands as reconciliation
entry points, but route both through canonical pair evaluation.

- [ ] **Step 7: Verify queue and scheduler**

```powershell
node --import tsx --test apps/agent/test/in-memory-job-queue.test.ts apps/agent/test/bullmq-job-queue.test.ts apps/agent/test/recommendation-scheduler.test.ts
npm.cmd run typecheck --workspace=@shire/agent
```

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add -- apps/agent/src/runtime/jobs/job-contracts.ts apps/agent/src/runtime/jobs/job-queue.ts apps/agent/src/runtime/jobs/in-memory-job-queue.ts apps/agent/src/runtime/jobs/bullmq-job-queue.ts apps/agent/src/runtime/jobs/recommendation-scheduler.ts apps/agent/src/runtime/server/job-services.ts apps/agent/src/routes/jobs.route.ts apps/agent/test/in-memory-job-queue.test.ts apps/agent/test/bullmq-job-queue.test.ts apps/agent/test/recommendation-scheduler.test.ts
git commit -m "feat(agent): deduplicate matching reconciliation jobs"
```

### Task 6: Replace Candidate Demo Intelligence With Persisted Data

**Files:**
- Create: `apps/web/lib/server/candidate-dashboard-repository.ts`
- Create: `apps/web/lib/server/candidate-dashboard-route.ts`
- Create: `apps/web/app/api/candidate/dashboard/route.ts`
- Create: `apps/web/lib/hooks/use-candidate-dashboard.ts`
- Modify: `apps/web/lib/server/recommendations-repository.ts`
- Modify: `apps/web/app/candidate/page.tsx`
- Modify: `apps/web/app/candidate/jobs/[id]/page.tsx`
- Modify: `apps/web/app/candidate/stakes/page.tsx`
- Modify: `apps/web/components/ai/ai-insight-card.tsx`
- Modify: `apps/web/components/ai/stake-recommendation-card.tsx`
- Test: `apps/web/test/candidate-dashboard-route.test.ts`
- Test: `apps/web/test/recommendations-route.test.ts`

- [ ] **Step 1: Write a failing candidate dashboard route test**

```ts
test("candidate dashboard returns persisted counts and top recommendations", async () => {
  const response = await handlers.GET(authenticatedRequest());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    activeApplicationCount: 1,
    availableJobCount: 4,
    newRecommendationCount: 2,
    applications: [expectedApplication],
    recommendations: [expectedRecommendation],
  });
});
```

- [ ] **Step 2: Run and verify RED**

```powershell
node --import tsx --test apps/web/test/candidate-dashboard-route.test.ts
```

Expected: FAIL because the route does not exist.

- [ ] **Step 3: Implement one bounded candidate dashboard query contract**

```ts
export type CandidateDashboard = {
  activeApplicationCount: number;
  availableJobCount: number;
  newRecommendationCount: number;
  applications: ApplicationSummary[];
  recommendations: Recommendation[];
};
```

Use aggregate counts and `limit(4)`/`limit(3)` for dashboard lists. Join jobs so
application cards show job title and company.

- [ ] **Step 4: Write a failing candidate job detail test**

Assert that the job detail response includes an optional persisted evaluation:

```ts
assert.deepEqual(body.match, {
  score: 83,
  confidence: 0.82,
  reasons: ["Required skills match"],
  missingRequirements: [],
  recommendedAction: "SUGGEST_APPLY",
});
```

- [ ] **Step 5: Implement candidate job detail from API state**

Extend the candidate job endpoint or add
`GET /api/candidate/jobs/[id]`. Authorize visibility, join the authenticated
candidate's evaluation/recommendation, and render that result. Delete calls to:

```ts
computeMatch(job, null);
computeRisk(job, null);
recommendStake(job, null);
```

Do not show a fabricated match card when no evaluation exists.

- [ ] **Step 6: Replace candidate page loading, empty, and error states**

Use one dashboard hook for dashboard data and focused hooks on detail pages.
Mutations must invalidate the candidate dashboard, applications, jobs, and
recommendation keys that changed.

- [ ] **Step 7: Verify candidate slice**

```powershell
node --import tsx --test apps/web/test/candidate-dashboard-route.test.ts apps/web/test/recommendations-route.test.ts apps/web/test/jobs-route.test.ts apps/web/test/applications-route.test.ts
npm.cmd run typecheck --workspace=@shire/web
```

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add -- apps/web/lib/server/candidate-dashboard-repository.ts apps/web/lib/server/candidate-dashboard-route.ts apps/web/app/api/candidate/dashboard/route.ts apps/web/lib/hooks/use-candidate-dashboard.ts apps/web/lib/server/recommendations-repository.ts apps/web/app/candidate/page.tsx apps/web/app/candidate/jobs/[id]/page.tsx apps/web/app/candidate/stakes/page.tsx apps/web/components/ai/ai-insight-card.tsx apps/web/components/ai/stake-recommendation-card.tsx apps/web/test/candidate-dashboard-route.test.ts apps/web/test/recommendations-route.test.ts
git commit -m "feat(web): use persisted candidate dashboard intelligence"
```

### Task 7: Replace Recruiter Dashboard Fixtures With Aggregated Data

**Files:**
- Create: `apps/web/lib/server/recruiter-dashboard-repository.ts`
- Create: `apps/web/lib/server/recruiter-dashboard-route.ts`
- Create: `apps/web/app/api/recruiter/dashboard/route.ts`
- Create: `apps/web/lib/hooks/use-recruiter-dashboard.ts`
- Modify: `apps/web/lib/server/applications-repository.ts`
- Modify: `apps/web/app/recruiter/page.tsx`
- Modify: `apps/web/app/recruiter/jobs/[id]/page.tsx`
- Modify: `apps/web/app/recruiter/applicants/page.tsx`
- Modify: `apps/web/components/dashboard/kpi-cards.tsx`
- Modify: `apps/web/components/dashboard/talent-reach.tsx`
- Modify: `apps/web/components/dashboard/catalog-table.tsx`
- Modify: `apps/web/components/dashboard/activity-chart.tsx`
- Modify: `apps/web/components/dashboard/match-donut.tsx`
- Modify: `apps/web/components/dashboard/pipeline-overview.tsx`
- Modify: `apps/web/components/dashboard/pipeline-lists.tsx`
- Test: `apps/web/test/recruiter-dashboard-route.test.ts`
- Test: `apps/web/test/applications-route.test.ts`

- [ ] **Step 1: Write a failing recruiter dashboard contract test**

```ts
test("recruiter dashboard aggregates only owned jobs", async () => {
  const response = await handlers.GET(authenticatedRequest());
  const body = await response.json();
  assert.deepEqual(body.kpis, {
    activeJobs: 1,
    applicants: 2,
    interviews: 1,
    offers: 0,
  });
  assert.equal(body.catalog.every((row: { recruiterUserId: string }) =>
    row.recruiterUserId === recruiter.id), true);
});
```

- [ ] **Step 2: Run and verify RED**

```powershell
node --import tsx --test apps/web/test/recruiter-dashboard-route.test.ts
```

Expected: FAIL because the dashboard route does not exist.

- [ ] **Step 3: Implement recruiter aggregates**

Return bounded, typed data for:

```ts
type RecruiterDashboard = {
  kpis: { activeJobs: number; applicants: number; interviews: number; offers: number };
  catalog: JobSummary[];
  activity: Array<{ date: string; applications: number }>;
  matchDistribution: Array<{ bucket: string; count: number }>;
  pipeline: Array<{ status: ApplicationStatus; count: number }>;
  recentApplicants: ApplicantSummary[];
  talentRegions: Array<{ region: string; count: number }>;
};
```

All queries must scope through recruiter-owned job IDs. Add a maximum date
window for activity and limits for catalog/applicant lists.

- [ ] **Step 4: Return authorized candidate summaries with applications**

Join candidate profiles for recruiter-owned applications. The API may expose
display name, headline, skills, location, and profile links needed by the
recruiter UI, but not private CV content or unrelated profile fields.

- [ ] **Step 5: Convert dashboard components to props**

Remove `dashboard-data.ts` imports. Components become presentational and receive
the API response from `RecruiterPage`. Preserve responsive dimensions and
explicit loading skeletons.

- [ ] **Step 6: Verify no authenticated recruiter fixture imports**

Run:

```powershell
rg -n "@/lib/dashboard-data|@/lib/seed|useShireStore" apps/web/app/recruiter apps/web/components/dashboard
```

Expected: no domain-data imports in recruiter pages or dashboard components.

- [ ] **Step 7: Run tests and typecheck**

```powershell
node --import tsx --test apps/web/test/recruiter-dashboard-route.test.ts apps/web/test/applications-route.test.ts apps/web/test/jobs-route.test.ts
npm.cmd run typecheck --workspace=@shire/web
```

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add -- apps/web/lib/server/recruiter-dashboard-repository.ts apps/web/lib/server/recruiter-dashboard-route.ts apps/web/app/api/recruiter/dashboard/route.ts apps/web/lib/hooks/use-recruiter-dashboard.ts apps/web/lib/server/applications-repository.ts apps/web/app/recruiter/page.tsx apps/web/app/recruiter/jobs/[id]/page.tsx apps/web/app/recruiter/applicants/page.tsx apps/web/components/dashboard apps/web/test/recruiter-dashboard-route.test.ts apps/web/test/applications-route.test.ts
git commit -m "feat(web): replace recruiter dashboard fixtures"
```

### Task 8: Add Database-Backed Stakes, Disputes, Admin, and Audit

**Files:**
- Modify: `apps/web/lib/server/db/schema.ts`
- Modify: `apps/agent/src/runtime/db/schema.ts`
- Create: `apps/web/lib/server/authorization.ts`
- Create: `apps/web/lib/server/stakes-repository.ts`
- Create: `apps/web/lib/server/disputes-repository.ts`
- Create: `apps/web/lib/server/admin-repository.ts`
- Create: `apps/web/lib/server/audit-repository.ts`
- Create: `apps/web/lib/server/stakes-route.ts`
- Create: `apps/web/lib/server/admin-route.ts`
- Create: `apps/web/app/api/stakes/route.ts`
- Create: `apps/web/app/api/admin/jobs/route.ts`
- Create: `apps/web/app/api/admin/stakes/route.ts`
- Create: `apps/web/app/api/admin/disputes/route.ts`
- Create: `apps/web/app/api/admin/overview/route.ts`
- Modify: `apps/web/app/candidate/stakes/page.tsx`
- Modify: `apps/web/app/recruiter/stakes/page.tsx`
- Modify: `apps/web/app/admin/page.tsx`
- Modify: `apps/web/components/admin/admin-job-table.tsx`
- Modify: `apps/web/components/admin/admin-stake-table.tsx`
- Modify: `apps/web/components/admin/dispute-review-panel.tsx`
- Create: `apps/web/test/stakes-route.test.ts`
- Create: `apps/web/test/admin-route.test.ts`

- [ ] **Step 1: Write failing repository tests for idempotency and state transitions**

```ts
test("stake creation is idempotent by authenticated actor and key", async () => {
  const first = await repository.createStake(input);
  const second = await repository.createStake(input);
  assert.equal(second.id, first.id);
});

test("refunding a slashed stake returns a conflict", async () => {
  await assert.rejects(
    repository.transitionStake(stake.id, "REFUNDED", admin.id),
    (error: unknown) =>
      error instanceof StakeTransitionError && error.code === "invalid-transition",
  );
});
```

- [ ] **Step 2: Run and verify RED**

```powershell
node --import tsx --test apps/web/test/stakes-route.test.ts apps/web/test/admin-route.test.ts
```

Expected: FAIL because repositories and routes do not exist.

- [ ] **Step 3: Add database schema**

Add text enums and tables:

```ts
stake_status: LOCKED | REFUNDED | SLASHED | RELEASED | CANCELLED
stake_type: JOB_POST | APPLICATION | INTERVIEW | OFFER | BOUNTY
dispute_status: OPEN | UNDER_REVIEW | RESOLVED | REJECTED
```

Tables:

- `stakes` with owner, optional job/application, type, amount, token, status,
  idempotency key, reason, and timestamps.
- `disputes` with reporter, optional job/stake, reason, status, AI summary,
  admin decision, and timestamps.
- `audit_logs` with actor, action, entity type, entity ID, metadata, and
  timestamp.

Generate a migration with indexes on owner, status, job, and created time.

- [ ] **Step 4: Implement server-enforced admin authorization**

```ts
export async function requireAdmin(
  request: Request,
  dependencies: AuthorizationDependencies,
) {
  const identity = await dependencies.authenticate(request);
  const user = await dependencies.users.resolveUser(identity.privyUserId);
  if (user.userType !== "ADMIN") {
    throw new AuthorizationError("admin-required");
  }
  return user;
}
```

Every admin route calls `requireAdmin` before reading or mutating domain data.

- [ ] **Step 5: Implement transactional mutations and audit**

Job moderation, stake transitions, and dispute resolution run in one database
transaction with an audit insert. Use stable 404, 409, and 403 error mappings.

- [ ] **Step 6: Replace authenticated store mutations**

Candidate, recruiter, and admin pages use query/mutation hooks. UI copy must say
`Platform escrow` and must not show a fake transaction hash.

- [ ] **Step 7: Verify admin and stake slice**

```powershell
node --import tsx --test apps/web/test/stakes-route.test.ts apps/web/test/admin-route.test.ts
npm.cmd run db:generate --workspace=@shire/web
npm.cmd run typecheck --workspace=@shire/web
```

Expected: PASS and one migration with the new tables.

- [ ] **Step 8: Commit**

```powershell
git add -- apps/web/lib/server/db/schema.ts apps/agent/src/runtime/db/schema.ts apps/web/drizzle apps/web/lib/server/authorization.ts apps/web/lib/server/stakes-repository.ts apps/web/lib/server/disputes-repository.ts apps/web/lib/server/admin-repository.ts apps/web/lib/server/audit-repository.ts apps/web/lib/server/stakes-route.ts apps/web/lib/server/admin-route.ts apps/web/app/api/stakes apps/web/app/api/admin apps/web/app/candidate/stakes/page.tsx apps/web/app/recruiter/stakes/page.tsx apps/web/app/admin/page.tsx apps/web/components/admin apps/web/test/stakes-route.test.ts apps/web/test/admin-route.test.ts
git commit -m "feat(web): persist platform escrow and admin operations"
```

### Task 9: Stream and Cancel Public Product Q&A

**Files:**
- Create: `apps/agent/src/runtime/knowledge/product-intent.ts`
- Create: `apps/agent/src/runtime/knowledge/product-qna-stream.ts`
- Modify: `apps/agent/src/runtime/knowledge/product-context.ts`
- Modify: `apps/agent/src/routes/product-qna.route.ts`
- Modify: `apps/web/app/api/product-assistant/route.ts`
- Modify: `apps/web/components/marketing/product-assistant.tsx`
- Modify: `apps/web/lib/chat/reasoning.ts`
- Test: `apps/agent/test/product-qna.test.ts`
- Test: `apps/agent/test/server.test.ts`
- Create: `apps/web/test/product-assistant-route.test.ts`

- [ ] **Step 1: Write failing intent-gate tests**

```ts
test("social chat skips product retrieval", async () => {
  let calls = 0;
  const result = await enrichChatRequestWithProductKnowledge(
    chatBody("Hi"),
    async () => {
      calls += 1;
      return [];
    },
  );
  assert.equal(calls, 0);
  assert.equal(result.retrievalSkipped, true);
});

test("product policy questions use retrieval", async () => {
  let calls = 0;
  await enrichChatRequestWithProductKnowledge(
    chatBody("How does Shire staking work?"),
    async () => {
      calls += 1;
      return [];
    },
  );
  assert.equal(calls, 1);
});
```

- [ ] **Step 2: Run and verify RED**

```powershell
node --import tsx --test apps/agent/test/product-qna.test.ts
```

Expected: FAIL because every valid chat question currently performs retrieval.

- [ ] **Step 3: Implement deterministic product intent classification**

Use bounded normalized term groups for product, policy, staking, escrow,
onboarding, role, and platform navigation. Resource-only and social intent skip
product retrieval. Keep a conservative `unknown` result that retrieves only
when no trusted resource context is present.

- [ ] **Step 4: Write failing stream and abort tests**

```ts
test("product Q&A emits progress, text, and finish events", async () => {
  const response = await fetchProductQna();
  const body = await response.text();
  assert.match(body, /"type":"data-status"/);
  assert.match(body, /"type":"text-delta"/);
  assert.match(body, /"type":"finish"/);
  assert.match(body, /data: \[DONE\]/);
});

test("request abort reaches product generation", async () => {
  const controller = new AbortController();
  const generation = createAbortAwareGeneration();
  const request = productRequest({ signal: controller.signal });
  controller.abort();
  await handler(request);
  assert.equal(generation.aborted, true);
});
```

- [ ] **Step 5: Run and verify RED**

```powershell
node --import tsx --test apps/agent/test/server.test.ts apps/web/test/product-assistant-route.test.ts
```

Expected: FAIL because Product Q&A currently buffers JSON and races a promise
without aborting generation.

- [ ] **Step 6: Implement AI SDK v6 compatible streaming**

Use Mastra `agent.stream()` and `toAISdkStream(..., { version: "v6" })`, or
`handleChatStream(..., { version: "v6" })` where the existing agent registration
fits. Use the request signal as the generation abort signal. Do not call
`consumeStream()` because the requirement is to stop provider work when the
client disconnects.

Emit safe custom progress data before retrieval and generation. Never forward
raw `<think>` text as answer content.

- [ ] **Step 7: Forward streaming without buffering in web**

The web route must return `upstream.body` directly:

```ts
return new Response(upstream.body, {
  status: upstream.status,
  headers: {
    "content-type":
      upstream.headers.get("content-type") ?? "text/event-stream",
    "cache-control": "no-cache, no-transform",
  },
});
```

Pass `request.signal` into `fetch`. The landing component reads UI-message SSE
parts incrementally, updates a bounded status label, appends answer deltas, and
supports cancellation on close/unmount.

- [ ] **Step 8: Verify Product Q&A and chat**

```powershell
node --import tsx --test apps/agent/test/product-qna.test.ts apps/agent/test/server.test.ts
node --import tsx --test apps/web/test/product-assistant-route.test.ts apps/web/test/chat-stream.test.ts
npm.cmd run typecheck --workspace=@shire/agent
npm.cmd run typecheck --workspace=@shire/web
```

Expected: PASS.

- [ ] **Step 9: Commit**

```powershell
git add -- apps/agent/src/runtime/knowledge/product-intent.ts apps/agent/src/runtime/knowledge/product-qna-stream.ts apps/agent/src/runtime/knowledge/product-context.ts apps/agent/src/routes/product-qna.route.ts apps/web/app/api/product-assistant/route.ts apps/web/components/marketing/product-assistant.tsx apps/web/lib/chat/reasoning.ts apps/agent/test/product-qna.test.ts apps/agent/test/server.test.ts apps/web/test/product-assistant-route.test.ts
git commit -m "feat(agent): stream cancellable intent-aware product Q&A"
```

### Task 10: Remove Authenticated Demo State and Add Quality Gates

**Files:**
- Modify: `apps/web/components/site/providers.tsx`
- Modify: `apps/web/components/site/privy-provider.tsx`
- Modify: `apps/web/components/layout/app-shell.tsx`
- Modify: `apps/web/components/layout/role-switcher.tsx`
- Modify: `apps/web/components/layout/notifications-menu.tsx`
- Modify: `apps/web/components/profile/candidate-profile-form.tsx`
- Modify: `apps/web/components/profile/recruiter-profile-form.tsx`
- Modify: `apps/web/components/profile/candidate-cv-upload.tsx`
- Modify: `apps/web/components/applications/application-card.tsx`
- Modify: `apps/web/components/ai/apply-kit-generator.tsx`
- Delete authenticated dependencies from: `apps/web/store/*`
- Keep landing-only fixtures in: `apps/web/lib/marketing.ts`
- Modify: `apps/web/eslint.config.mjs`
- Modify: `apps/web/package.json`
- Modify: `apps/agent/package.json`
- Modify: root `package.json`
- Create: `apps/web/test/authenticated-demo-imports.test.ts`
- Create: `apps/web/test/integration-critical-paths.test.ts`

- [ ] **Step 1: Write a failing authenticated import-boundary test**

```ts
test("authenticated code does not import demo domain data", async () => {
  const violations = await findImports({
    roots: [
      "apps/web/app/candidate",
      "apps/web/app/recruiter",
      "apps/web/app/admin",
      "apps/web/components/admin",
      "apps/web/components/applications",
      "apps/web/components/dashboard",
      "apps/web/components/profile",
    ],
    forbidden: [
      "@/lib/seed",
      "@/lib/dashboard-data",
      "@/lib/store",
      "@/store",
    ],
  });
  assert.deepEqual(violations, []);
});
```

- [ ] **Step 2: Run and verify RED**

```powershell
node --import tsx --test apps/web/test/authenticated-demo-imports.test.ts
```

Expected: FAIL and list every remaining authenticated demo import.

- [ ] **Step 3: Replace remaining domain store usage**

Move profile, role, wallet display, notifications, saved jobs, application
status, and apply-kit data to authenticated APIs or local non-domain UI state.
Delete store actions that create jobs, applications, stakes, disputes, or
recommendations.

Do not add fallback demo data when auth or API calls fail.

- [ ] **Step 4: Repair lint dependency resolution**

Use the workspace's installed ESLint and `eslint-config-next` versions. Remove
stale package-manager links, run `npm.cmd install`, and ensure:

```powershell
npm.cmd run lint --workspace=@shire/web
```

Expected: ESLint executes against source and exits 0.

- [ ] **Step 5: Add stable root quality scripts**

Root scripts:

```json
{
  "scripts": {
    "test": "turbo run test",
    "verify": "npm run lint && npm run typecheck && npm run test && npm run build"
  }
}
```

Agent live scripts must remain separate and opt-in:

```json
{
  "scripts": {
    "test:live:llm": "node --env-file-if-exists=.env --import tsx --test test/live-cv-worker.test.ts",
    "test:live:queue": "node --env-file-if-exists=.env --import tsx --test test/live-bullmq.test.ts"
  }
}
```

- [ ] **Step 6: Run full static and automated verification**

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
```

Expected: all commands exit 0 without live provider calls.

- [ ] **Step 7: Start local services and run browser critical paths**

Start the app with:

```powershell
npm.cmd run dev
```

Verify:

1. Landing Product Q&A streams status and answer.
2. Candidate profile save triggers reconciliation.
3. Candidate dashboard loads persisted recommendations.
4. Candidate job chat has the actual job context.
5. Recruiter dashboard uses database aggregates.
6. Recruiter job chat rejects foreign jobs.
7. Admin pages reject non-admin users.
8. Admin stake/dispute mutations update database state.
9. Every page has working loading, empty, and error states.
10. Browser console has no uncaught errors or hydration warnings.

- [ ] **Step 8: Commit**

```powershell
git add -- apps/web/components apps/web/app apps/web/store apps/web/lib apps/web/test/authenticated-demo-imports.test.ts apps/web/test/integration-critical-paths.test.ts apps/web/eslint.config.mjs apps/web/package.json apps/agent/package.json package.json package-lock.json
git commit -m "refactor(web): remove authenticated demo domain state"
```

### Task 11: Final Migration and End-to-End Verification

**Files:**
- Modify only files required by failures found during final verification.
- Update: `README.md`
- Update: `apps/agent/README.md`

- [ ] **Step 1: Apply migrations against an isolated database**

```powershell
npm.cmd run db:migrate --workspace=@shire/web
```

Expected: migrations apply from the previous schema without destructive data
loss.

- [ ] **Step 2: Run matching reconciliation twice**

With two confirmed candidates and one active job:

```powershell
npm.cmd run job:job-matching --workspace=@shire/agent
```

Expected first reconciliation: at most two pair jobs.
Expected second reconciliation with unchanged data: zero pair jobs.

- [ ] **Step 3: Inspect persisted invariants**

Confirm:

- Two `matching_evaluations` rows at most.
- No duplicate recommendation unique keys.
- Negative outcomes have completed evaluation rows.
- No queued duplicate job IDs.
- Closing the job deactivates related recommendations.

- [ ] **Step 4: Run full verification again**

```powershell
npm.cmd run verify
git diff --check
git status --short --branch
```

Expected: verify exits 0, diff check is clean, and status contains only intended
documentation updates.

- [ ] **Step 5: Document operating model**

README updates must explain:

- Shared Postgres ownership.
- Redis requirement for durable production jobs.
- Matching reconciliation and deduplication.
- Turso memory and knowledge responsibilities.
- Default versus live test commands.
- Platform escrow limitation before on-chain settlement.

- [ ] **Step 6: Commit documentation**

```powershell
git add -- README.md apps/agent/README.md
git commit -m "docs: document production web-agent operating model"
```

- [ ] **Step 7: Review commit history**

```powershell
git log --oneline --decorate --max-count=15
git status --short --branch
```

Expected: one focused commit per vertical slice and a clean worktree.

