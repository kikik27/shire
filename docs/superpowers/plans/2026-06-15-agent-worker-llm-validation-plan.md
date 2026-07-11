# Agent Worker and LLM Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove that Shire can accept a real background job, process it through a persistent worker, execute the domain pipeline and a Mastra LLM agent only when required, persist an auditable result, and expose status for CLI and Postman testing before BullMQ is introduced.

**Architecture:** Add a queue-neutral job contract and processor layer under `apps/agent/src/runtime/jobs/`. A persistent in-memory worker will consume validated jobs submitted through HTTP, while job processors remain independent from the queue implementation so BullMQ can replace the in-memory adapter later. The first complete LLM-backed vertical slice is `cv-parse`; deterministic jobs remain explicitly marked and must not call an LLM.

**Tech Stack:** TypeScript, Node.js, Express, Mastra, AI SDK v6, Zod, libSQL-backed candidate profile storage, OpenRouter model routing, built-in `node:test`.

---

## Scope

This plan includes:

- typed job payloads and results
- a persistent in-memory worker
- HTTP enqueue and status endpoints
- graceful worker startup and shutdown
- real `cv-parse` domain-pipeline execution
- real LLM-backed CV normalization
- embedding and profile persistence
- usage and model metadata
- deterministic proof that non-LLM jobs do not invoke a model
- integration and optional live-provider tests

This plan deliberately excludes:

- BullMQ and Redis
- distributed worker coordination
- delayed or scheduled jobs
- production authentication for job endpoints
- all domain jobs becoming fully production-ready
- Stellar transaction execution

BullMQ is the next phase after the processor contract and LLM behavior pass the acceptance tests in this plan.

## Runtime Flow

```text
POST /jobs
  -> validate job envelope and payload
  -> enqueue into InMemoryJobQueue
  -> return 202 + jobId

AgentWorker
  -> reserve next queued job
  -> mark active
  -> dispatch to JobProcessorRegistry
  -> run deterministic workflow stages
  -> call Mastra agent only when processor policy requires it
  -> persist result and usage
  -> mark completed or failed

GET /jobs/:jobId
  -> return queued | active | completed | failed
  -> include result or structured error
```

## File Structure

Create:

- `apps/agent/src/runtime/jobs/job-contracts.ts`: job names, envelopes, payload schemas, result schemas, and status types.
- `apps/agent/src/runtime/jobs/job-queue.ts`: queue interface used by server and worker.
- `apps/agent/src/runtime/jobs/in-memory-job-queue.ts`: persistent-process queue adapter for this phase.
- `apps/agent/src/runtime/jobs/job-processor.ts`: processor interface and execution context.
- `apps/agent/src/runtime/jobs/job-processors.ts`: processor registry and typed dispatch.
- `apps/agent/src/runtime/jobs/agent-worker.ts`: worker lifecycle and processing loop.
- `apps/agent/src/runtime/jobs/cv-parse.processor.ts`: real CV parsing vertical slice.
- `apps/agent/src/runtime/jobs/onchain-sync.processor.ts`: deterministic control processor that never invokes an LLM.
- `apps/agent/src/runtime/cv-agent-generator.ts`: adapter from `cvProfileAgent.generate()` to the existing CV normalization pipeline.
- `apps/agent/test/job-contracts.test.ts`
- `apps/agent/test/in-memory-job-queue.test.ts`
- `apps/agent/test/job-processors.test.ts`
- `apps/agent/test/agent-worker.test.ts`
- `apps/agent/test/cv-agent-generator.test.ts`
- `apps/agent/test/jobs-http.test.ts`
- `apps/agent/test/live-cv-worker.test.ts`

Modify:

- `apps/agent/src/env.ts`
- `apps/agent/src/server.ts`
- `apps/agent/src/runtime/job-registry.ts`
- `apps/agent/src/jobs/run-cv-parse.ts`
- `apps/agent/src/jobs/run-onchain-sync.ts`
- `apps/agent/src/runtime/cv-normalizer.ts`
- `apps/agent/test/env.test.ts`
- `apps/agent/test/index.ts`
- `apps/agent/.env.example`
- `apps/agent/README.md`

## Job Contract

The worker-facing contract must distinguish fixture metadata from executed results.

```ts
export type JobName = "cv-parse" | "onchain-sync";

export type JobStatus = "queued" | "active" | "completed" | "failed";

export type JobEnvelope<TName extends JobName = JobName> = {
  id: string;
  name: TName;
  payload: JobPayloadMap[TName];
  status: JobStatus;
  attempts: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  result?: JobResultMap[TName];
  error?: {
    code: string;
    message: string;
  };
};

export type JobPayloadMap = {
  "cv-parse": {
    candidateId: string;
    rawCv: string;
  };
  "onchain-sync": {
    chain: "Stellar";
  };
};

export type JobRequest<TName extends JobName = JobName> = {
  name: TName;
  payload: JobPayloadMap[TName];
};

export type JobResultMap = {
  "cv-parse": {
    candidateId: string;
    status: "PENDING_REVIEW";
    profile: CandidateProfile;
    embeddingDimensions: number;
    usage: ModelUsageRecord[];
    llmInvoked: true;
  };
  "onchain-sync": {
    status: "ready";
    chain: "Stellar";
    llmInvoked: false;
  };
};

export type JobResult = JobResultMap[JobName];
```

`cv-parse` is the LLM-backed proof job. `onchain-sync` is the deterministic control job.

---

### Task 1: Define Typed Job Contracts

**Files:**

- Create: `apps/agent/src/runtime/jobs/job-contracts.ts`
- Create: `apps/agent/test/job-contracts.test.ts`
- Modify: `apps/agent/test/index.ts`

- [ ] **Step 1: Write failing schema tests**

Add tests that require:

```ts
test("parses a valid cv parse payload", () => {
  assert.deepEqual(
    parseJobRequest({
      name: "cv-parse",
      payload: {
        candidateId: "candidate-001",
        rawCv: "Senior TypeScript engineer",
      },
    }),
    {
      name: "cv-parse",
      payload: {
        candidateId: "candidate-001",
        rawCv: "Senior TypeScript engineer",
      },
    },
  );
});

test("rejects an empty CV", () => {
  assert.throws(() =>
    parseJobRequest({
      name: "cv-parse",
      payload: { candidateId: "candidate-001", rawCv: "" },
    }),
  );
});

test("rejects unknown jobs", () => {
  assert.throws(() => parseJobRequest({ name: "unknown", payload: {} }));
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
node --import tsx --test test/job-contracts.test.ts
```

Expected: FAIL because `job-contracts.ts` does not exist.

- [ ] **Step 3: Implement discriminated Zod schemas**

Implement:

```ts
const cvParseRequestSchema = z.object({
  name: z.literal("cv-parse"),
  payload: z.object({
    candidateId: z.string().trim().min(1),
    rawCv: z.string().trim().min(1).max(100_000),
  }),
});

const onchainSyncRequestSchema = z.object({
  name: z.literal("onchain-sync"),
  payload: z.object({
    chain: z.literal("Stellar"),
  }),
});

export const jobRequestSchema = z.discriminatedUnion("name", [
  cvParseRequestSchema,
  onchainSyncRequestSchema,
]);

export function parseJobRequest(input: unknown) {
  return jobRequestSchema.parse(input);
}
```

Define `JobName`, `JobPayloadMap`, `JobResultMap`, `JobStatus`, and `JobEnvelope` from these stable contracts.

- [ ] **Step 4: Run tests and verify GREEN**

Run:

```powershell
node --import tsx --test test/job-contracts.test.ts
```

Expected: all contract tests pass.

- [ ] **Step 5: Commit**

```powershell
git add -- apps/agent/src/runtime/jobs/job-contracts.ts apps/agent/test/job-contracts.test.ts apps/agent/test/index.ts
git commit -m "feat(agent): define worker job contracts"
```

### Task 2: Add a Queue-Neutral In-Memory Adapter

**Files:**

- Create: `apps/agent/src/runtime/jobs/job-queue.ts`
- Create: `apps/agent/src/runtime/jobs/in-memory-job-queue.ts`
- Create: `apps/agent/test/in-memory-job-queue.test.ts`
- Modify: `apps/agent/test/index.ts`

- [ ] **Step 1: Write failing queue behavior tests**

Cover:

```ts
test("enqueues and reserves jobs in FIFO order", async () => {
  const queue = new InMemoryJobQueue();
  const first = await queue.enqueue({
    name: "onchain-sync",
    payload: { chain: "Stellar" },
  });
  const second = await queue.enqueue({
    name: "cv-parse",
    payload: { candidateId: "candidate-001", rawCv: "CV" },
  });

  assert.equal((await queue.reserve())?.id, first.id);
  assert.equal((await queue.reserve())?.id, second.id);
});

test("tracks completed results", async () => {
  const queue = new InMemoryJobQueue();
  const job = await queue.enqueue({
    name: "onchain-sync",
    payload: { chain: "Stellar" },
  });

  await queue.markActive(job.id);
  await queue.markCompleted(job.id, {
    status: "ready",
    chain: "Stellar",
    llmInvoked: false,
  });

  assert.equal((await queue.get(job.id))?.status, "completed");
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
node --import tsx --test test/in-memory-job-queue.test.ts
```

Expected: FAIL because the queue classes do not exist.

- [ ] **Step 3: Implement the queue interface**

The interface must expose:

```ts
export interface JobQueue {
  enqueue(request: JobRequest): Promise<JobEnvelope>;
  reserve(): Promise<JobEnvelope | undefined>;
  get(jobId: string): Promise<JobEnvelope | undefined>;
  markActive(jobId: string): Promise<void>;
  markCompleted(jobId: string, result: JobResult): Promise<void>;
  markFailed(
    jobId: string,
    error: { code: string; message: string },
  ): Promise<void>;
  waitForJob(signal: AbortSignal): Promise<void>;
}
```

Use a `Map` for records, an array for FIFO IDs, `crypto.randomUUID()` for IDs, and a pending resolver set for worker wake-up. Return cloned records so callers cannot mutate queue state.

- [ ] **Step 4: Run tests and verify GREEN**

Run:

```powershell
node --import tsx --test test/in-memory-job-queue.test.ts
```

Expected: all queue tests pass.

- [ ] **Step 5: Commit**

```powershell
git add -- apps/agent/src/runtime/jobs/job-queue.ts apps/agent/src/runtime/jobs/in-memory-job-queue.ts apps/agent/test/in-memory-job-queue.test.ts apps/agent/test/index.ts
git commit -m "feat(agent): add in-memory worker queue"
```

### Task 3: Define Processor Boundaries and LLM Policy

**Files:**

- Create: `apps/agent/src/runtime/jobs/job-processor.ts`
- Create: `apps/agent/src/runtime/jobs/job-processors.ts`
- Create: `apps/agent/src/runtime/jobs/onchain-sync.processor.ts`
- Create: `apps/agent/test/job-processors.test.ts`
- Modify: `apps/agent/test/index.ts`

- [ ] **Step 1: Write failing dispatch tests**

Require the registry to:

```ts
test("dispatches the deterministic onchain job without an LLM", async () => {
  let llmCalls = 0;
  const processors = createJobProcessors({
    generateCvProfile: async () => {
      llmCalls += 1;
      throw new Error("not expected");
    },
  });

  const result = await processors.process({
    id: "job-1",
    name: "onchain-sync",
    payload: { chain: "Stellar" },
  });

  assert.equal(result.llmInvoked, false);
  assert.equal(llmCalls, 0);
});
```

Also test that an unsupported name cannot reach processor execution.

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
node --import tsx --test test/job-processors.test.ts
```

Expected: FAIL because the processor registry does not exist.

- [ ] **Step 3: Implement processor contracts**

Use:

```ts
export type JobExecutionContext = {
  jobId: string;
  attempt: number;
  signal: AbortSignal;
};

export interface JobProcessor<TName extends JobName> {
  name: TName;
  llmPolicy: "required" | "forbidden";
  process(
    payload: JobPayloadMap[TName],
    context: JobExecutionContext,
  ): Promise<JobResultMap[TName]>;
}
```

The registry must select by `job.name`, pass the abort signal, and return the typed result. `onchain-sync.processor.ts` must return:

```ts
{
  status: "ready",
  chain: "Stellar",
  llmInvoked: false
}
```

- [ ] **Step 4: Run tests and verify GREEN**

Run:

```powershell
node --import tsx --test test/job-processors.test.ts
```

Expected: dispatch tests pass and deterministic jobs produce zero model calls.

- [ ] **Step 5: Commit**

```powershell
git add -- apps/agent/src/runtime/jobs/job-processor.ts apps/agent/src/runtime/jobs/job-processors.ts apps/agent/src/runtime/jobs/onchain-sync.processor.ts apps/agent/test/job-processors.test.ts apps/agent/test/index.ts
git commit -m "feat(agent): define job processor boundaries"
```

### Task 4: Adapt the CV Agent to Structured LLM Generation

**Files:**

- Create: `apps/agent/src/runtime/cv-agent-generator.ts`
- Create: `apps/agent/test/cv-agent-generator.test.ts`
- Modify: `apps/agent/src/runtime/cv-normalizer.ts`
- Modify: `apps/agent/test/index.ts`

- [ ] **Step 1: Write failing adapter tests**

Inject a fake agent and assert that:

- raw CV is sent as a user message
- workload is `cv-normalization`
- memory IDs are job-scoped
- parsed structured output is returned
- usage and resolved model ID are retained

The desired call shape is:

```ts
const result = await generateCandidateProfile({
  agent,
  candidateId: "candidate-001",
  jobId: "job-1",
  rawCv: "Senior TypeScript engineer",
});

assert.equal(result.profile.fullName, "Maya Okafor");
assert.equal(result.model, "openrouter/test-model");
assert.equal(result.usage.totalTokens, 42);
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
node --import tsx --test test/cv-agent-generator.test.ts
```

Expected: FAIL because `generateCandidateProfile` does not exist.

- [ ] **Step 3: Implement the Mastra agent adapter**

Call `cvProfileAgent.generate()` through an injected compatible agent:

```ts
const response = await agent.generate(
  [
    {
      role: "user",
      content: [
        "Normalize this CV into the required candidate profile schema.",
        "Do not invent facts.",
        input.rawCv,
      ].join("\n\n"),
    },
  ],
  {
    requestContext,
    memory: {
      thread: `cv-parse:${input.candidateId}`,
      resource: `candidate:${input.candidateId}`,
    },
    structuredOutput: {
      schema: candidateProfileSchema,
    },
    maxOutputTokens: getWorkloadPolicy("cv-normalization").maxOutputTokens,
  },
);
```

Parse the returned structured value with `candidateProfileSchema`. Return:

```ts
{
  (profile, model, usage);
}
```

Do not silently fall back to fixture output when generation fails.

- [ ] **Step 4: Run tests and verify GREEN**

Run:

```powershell
node --import tsx --test test/cv-agent-generator.test.ts test/cv-normalizer.test.ts
```

Expected: adapter and existing normalization tests pass.

- [ ] **Step 5: Commit**

```powershell
git add -- apps/agent/src/runtime/cv-agent-generator.ts apps/agent/src/runtime/cv-normalizer.ts apps/agent/test/cv-agent-generator.test.ts apps/agent/test/index.ts
git commit -m "feat(agent): add structured CV agent generation"
```

### Task 5: Build the Real CV Parse Processor

**Files:**

- Create: `apps/agent/src/runtime/jobs/cv-parse.processor.ts`
- Modify: `apps/agent/src/runtime/jobs/job-processors.ts`
- Modify: `apps/agent/src/jobs/run-cv-parse.ts`
- Create: `apps/agent/test/cv-parse-processor.test.ts`
- Modify: `apps/agent/test/index.ts`

- [ ] **Step 1: Write failing processor tests**

Inject generator, embedder, and profile store fakes. Assert:

```ts
assert.equal(result.llmInvoked, true);
assert.equal(result.status, "PENDING_REVIEW");
assert.equal(result.candidateId, "candidate-001");
assert.equal(result.embeddingDimensions, 3);
assert.equal(result.usage.length, 1);
assert.equal(result.usage[0].totalTokens, 42);
```

Also assert that:

- the supplied payload, not `jobRunnerData`, is processed
- raw CV text is not persisted
- generator failure rejects the processor
- embedding failure rejects the processor

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
node --import tsx --test test/cv-parse-processor.test.ts
```

Expected: FAIL because the processor does not exist.

- [ ] **Step 3: Implement the processor**

Compose the existing `runParseCvPipeline()` with real defaults:

```ts
export function createCvParseProcessor(
  dependencies = {
    generate: generateCandidateProfile,
    embed: embedCandidateProfile,
    store: candidateProfileStore,
  },
): JobProcessor<"cv-parse"> {
  return {
    name: "cv-parse",
    llmPolicy: "required",
    async process(payload, context) {
      const record = await runParseCvPipeline({
        candidateId: payload.candidateId,
        rawCv: payload.rawCv,
        generate: ({ rawCv }) =>
          dependencies.generate({
            candidateId: payload.candidateId,
            jobId: context.jobId,
            rawCv,
          }),
        embed: dependencies.embed,
        store: dependencies.store,
      });

      return {
        candidateId: payload.candidateId,
        status: record.status,
        profile: record.profile,
        embeddingDimensions: record.embedding.length,
        usage: record.usage,
        llmInvoked: true,
      };
    },
  };
}
```

Update `run-cv-parse.ts` so direct CLI execution uses the same processor and accepts a JSON payload argument or fixture only when explicitly passed `--fixture`. Default execution must not report `usage: []` as a successful LLM run.

- [ ] **Step 4: Run tests and verify GREEN**

Run:

```powershell
node --import tsx --test test/cv-parse-processor.test.ts test/jobs-data.test.ts
```

Expected: CV processor tests pass; fixture tests are updated to describe fixture mode explicitly.

- [ ] **Step 5: Commit**

```powershell
git add -- apps/agent/src/runtime/jobs/cv-parse.processor.ts apps/agent/src/runtime/jobs/job-processors.ts apps/agent/src/jobs/run-cv-parse.ts apps/agent/test/cv-parse-processor.test.ts apps/agent/test/jobs-data.test.ts apps/agent/test/index.ts
git commit -m "feat(agent): execute CV jobs through the real pipeline"
```

### Task 6: Implement the Persistent Worker Loop

**Files:**

- Create: `apps/agent/src/runtime/jobs/agent-worker.ts`
- Create: `apps/agent/test/agent-worker.test.ts`
- Modify: `apps/agent/test/index.ts`

- [ ] **Step 1: Write failing lifecycle tests**

Test:

```ts
test("processes an enqueued job to completion", async () => {
  const queue = new InMemoryJobQueue();
  const worker = new AgentWorker({
    queue,
    process: async () => ({
      status: "ready",
      chain: "Stellar",
      llmInvoked: false,
    }),
  });

  worker.start();
  const job = await queue.enqueue({
    name: "onchain-sync",
    payload: { chain: "Stellar" },
  });

  const completed = await waitForJobStatus(queue, job.id, "completed");
  assert.equal(completed.result?.llmInvoked, false);
  await worker.close();
});
```

Also test:

- processor exceptions mark jobs failed
- worker continues after one failed job
- `close()` stops waiting and waits for the active job
- jobs are not processed twice

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
node --import tsx --test test/agent-worker.test.ts
```

Expected: FAIL because `AgentWorker` does not exist.

- [ ] **Step 3: Implement worker lifecycle**

The worker must:

```ts
class AgentWorker {
  start(): void;
  close(): Promise<void>;
}
```

Its loop must:

1. reserve a job
2. wait on `queue.waitForJob(signal)` when empty
3. mark the job active
4. call the processor registry
5. mark completed with result
6. catch and normalize errors into `WORKER_EXECUTION_FAILED`
7. continue unless shutdown was requested

Use a single concurrency slot in this phase. Do not add retry/backoff until BullMQ.

- [ ] **Step 4: Run tests and verify GREEN**

Run:

```powershell
node --import tsx --test test/agent-worker.test.ts
```

Expected: all lifecycle tests pass.

- [ ] **Step 5: Commit**

```powershell
git add -- apps/agent/src/runtime/jobs/agent-worker.ts apps/agent/test/agent-worker.test.ts apps/agent/test/index.ts
git commit -m "feat(agent): add persistent worker loop"
```

### Task 7: Expose Enqueue and Status Endpoints

**Files:**

- Modify: `apps/agent/src/server.ts`
- Create: `apps/agent/test/jobs-http.test.ts`
- Modify: `apps/agent/test/index.ts`

- [ ] **Step 1: Write failing HTTP tests**

Require:

```http
POST /jobs
Content-Type: application/json

{
  "name": "onchain-sync",
  "payload": { "chain": "Stellar" }
}
```

Expected initial response:

```json
{
  "jobId": "<uuid>",
  "status": "queued"
}
```

Then:

```http
GET /jobs/<uuid>
```

must eventually return:

```json
{
  "id": "<uuid>",
  "name": "onchain-sync",
  "status": "completed",
  "result": {
    "status": "ready",
    "chain": "Stellar",
    "llmInvoked": false
  }
}
```

Also assert invalid payload returns HTTP `400`, unknown IDs return `404`, and processor failure returns a completed HTTP request with job status `failed`.

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
node --import tsx --test test/jobs-http.test.ts
```

Expected: FAIL because `/jobs` routes do not exist.

- [ ] **Step 3: Wire queue and worker into server lifecycle**

`createRuntimeHttpServer()` must accept optional queue and processor dependencies for tests. Production startup must create one queue and one worker, start the worker before listening, and close the worker when the HTTP server closes.

Add:

```ts
app.post("/jobs", async (request, response) => {
  const parsed = parseJobRequest(request.body);
  const job = await queue.enqueue(parsed);
  response.status(202).json({ jobId: job.id, status: job.status });
});

app.get("/jobs/:jobId", async (request, response) => {
  const job = await queue.get(request.params.jobId);
  if (!job) {
    response.status(404).json({ status: "not-found" });
    return;
  }
  response.json(job);
});
```

Convert Zod errors to a bounded `400` response without exposing stack traces.

- [ ] **Step 4: Run tests and verify GREEN**

Run:

```powershell
node --import tsx --test test/jobs-http.test.ts test/server.test.ts
```

Expected: job routes and existing chat routes pass together.

- [ ] **Step 5: Commit**

```powershell
git add -- apps/agent/src/server.ts apps/agent/test/jobs-http.test.ts apps/agent/test/server.test.ts apps/agent/test/index.ts
git commit -m "feat(agent): expose worker job endpoints"
```

### Task 8: Add Worker Configuration and Operational Logging

**Files:**

- Modify: `apps/agent/src/env.ts`
- Modify: `apps/agent/src/runtime/jobs/agent-worker.ts`
- Modify: `apps/agent/test/env.test.ts`
- Modify: `apps/agent/.env.example`
- Modify: `apps/agent/README.md`

- [ ] **Step 1: Write failing environment tests**

Require:

```ts
assert.equal(createEnv({}).workerEnabled, true);
assert.equal(createEnv({}).liveLlmTestsEnabled, false);
assert.equal(createEnv({ SHIRE_WORKER_ENABLED: "false" }).workerEnabled, false);
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
node --import tsx --test test/env.test.ts
```

Expected: FAIL because worker settings do not exist.

- [ ] **Step 3: Add bounded worker configuration**

Add:

```env
SHIRE_WORKER_ENABLED=true
SHIRE_LIVE_LLM_TESTS=false
```

Log these lifecycle events with `jobId`, `jobName`, `attempt`, and duration:

- `worker started`
- `job queued`
- `job started`
- `job completed`
- `job failed`
- `worker stopped`

Never log raw CV text, model credentials, embeddings, or full agent messages.

- [ ] **Step 4: Run tests and verify GREEN**

Run:

```powershell
node --import tsx --test test/env.test.ts test/agent-worker.test.ts
```

Expected: environment and worker tests pass.

- [ ] **Step 5: Commit**

```powershell
git add -- apps/agent/src/env.ts apps/agent/src/runtime/jobs/agent-worker.ts apps/agent/test/env.test.ts apps/agent/.env.example apps/agent/README.md
git commit -m "feat(agent): configure worker runtime"
```

### Task 9: Add an Opt-In Live LLM Worker Test

**Files:**

- Create: `apps/agent/test/live-cv-worker.test.ts`
- Modify: `apps/agent/test/index.ts`
- Modify: `apps/agent/README.md`

- [ ] **Step 1: Write an opt-in live test**

The test must skip unless both conditions are true:

```ts
const liveEnabled = process.env.SHIRE_LIVE_LLM_TESTS === "true";
const hasKey = Boolean(process.env.OPENROUTER_API_KEY);
```

When enabled, enqueue:

```json
{
  "name": "cv-parse",
  "payload": {
    "candidateId": "live-test-candidate",
    "rawCv": "Maya Okafor. Senior frontend engineer. TypeScript, React, accessibility."
  }
}
```

Assert:

- final status is `completed`
- `result.llmInvoked === true`
- `result.usage.length >= 1`
- usage contains a non-empty provider and model
- `totalTokens` is greater than zero when the provider returns token accounting
- persisted profile status is `PENDING_REVIEW`
- raw CV text is absent from persisted profile data

- [ ] **Step 2: Run without credentials**

Run:

```powershell
npm.cmd run test --workspace=@shire/agent
```

Expected: regular tests pass and the live test is explicitly skipped.

- [ ] **Step 3: Run with a real provider**

From `apps/agent`, with `.env` containing a valid `OPENROUTER_API_KEY`:

```powershell
$env:SHIRE_LIVE_LLM_TESTS="true"
node --env-file-if-exists=.env --import tsx --test test/live-cv-worker.test.ts
```

Expected: one real OpenRouter generation, one embedding request, completed worker job, non-empty usage metadata, and a persisted pending-review profile.

- [ ] **Step 4: Document live-test failure interpretation**

Document:

- `401`: missing or invalid provider key
- `402/429`: provider credit or rate limit
- schema failure: selected model cannot reliably produce the required structured output
- embedding failure: configured embedding model or endpoint is unavailable
- worker timeout: processor did not settle and needs cancellation instrumentation

- [ ] **Step 5: Commit**

```powershell
git add -- apps/agent/test/live-cv-worker.test.ts apps/agent/test/index.ts apps/agent/README.md
git commit -m "test(agent): verify live LLM worker execution"
```

### Task 10: Final Verification and BullMQ Readiness Gate

**Files:**

- Review: `apps/agent/src/runtime/jobs/`
- Review: `apps/agent/src/runtime/cv-agent-generator.ts`
- Review: `apps/agent/src/server.ts`
- Review: `apps/agent/README.md`

- [ ] **Step 1: Run static verification**

```powershell
npm.cmd run typecheck --workspace=@shire/agent
npm.cmd run build --workspace=@shire/agent
```

Expected: both exit `0`.

- [ ] **Step 2: Run the complete deterministic suite**

```powershell
npm.cmd run test --workspace=@shire/agent
```

Expected: all deterministic tests pass; live LLM test is skipped unless explicitly enabled.

- [ ] **Step 3: Test deterministic worker through Postman**

Start:

```powershell
npm.cmd run dev --workspace=@shire/agent
```

Submit `onchain-sync` through `POST http://localhost:3010/jobs`, poll `GET /jobs/:jobId`, and verify:

- transition `queued -> active -> completed`
- `llmInvoked: false`
- no OpenRouter request in logs

- [ ] **Step 4: Test LLM-backed worker through Postman**

Submit:

```json
{
  "name": "cv-parse",
  "payload": {
    "candidateId": "candidate-postman-001",
    "rawCv": "Maya Okafor. Senior frontend engineer with TypeScript, React, design systems, and accessibility experience."
  }
}
```

Poll the returned job ID and verify:

- transition `queued -> active -> completed`
- `llmInvoked: true`
- model and provider appear in usage metadata
- profile is `PENDING_REVIEW`
- embedding dimension is greater than zero
- raw CV is not included in the response or persisted profile

- [ ] **Step 5: Apply the BullMQ readiness gate**

Proceed to BullMQ only when all are true:

- the worker remains alive across multiple jobs
- one failed job does not terminate the worker
- deterministic jobs produce zero LLM calls
- `cv-parse` proves a real model call and embedding call
- job status can be polled independently from submission
- processors depend only on `JobQueue`/`JobProcessor` contracts
- no processor imports the in-memory queue implementation
- worker shutdown waits for an active job
- all job payloads are schema-validated
- logs identify job/model usage without exposing sensitive input

- [ ] **Step 6: Commit verification documentation**

```powershell
git add -- apps/agent/README.md docs/superpowers/plans/2026-06-15-agent-worker-llm-validation-plan.md
git commit -m "docs(agent): define worker LLM readiness gate"
```

## Acceptance Criteria

The phase is complete only when:

1. `POST /jobs` returns `202` with a job ID.
2. A persistent worker consumes more than one job without restarting.
3. `GET /jobs/:jobId` reports real lifecycle states.
4. `onchain-sync` completes with `llmInvoked: false`.
5. `cv-parse` processes request payload rather than fixture data.
6. `cv-parse` invokes a real Mastra agent in the opt-in live test.
7. The model/provider and token usage are observable.
8. The candidate profile and embedding are persisted without raw CV text.
9. Failed LLM or embedding calls produce `failed` job state.
10. The queue implementation can later be replaced by BullMQ without changing processor code.
