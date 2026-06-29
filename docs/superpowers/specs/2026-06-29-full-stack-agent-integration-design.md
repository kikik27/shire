# Full-Stack Agent Integration Design

## Status

Approved for implementation on 2026-06-29.

## Objective

Make every authenticated Shire flow use real API and database state, integrate
web and agent through explicit internal boundaries, prevent redundant matching
work, and make tests deterministic without contacting live infrastructure.

Demo data is allowed only on the public landing page.

## Scope

This design covers:

1. Page-aware candidate and recruiter chat.
2. Incremental and deduplicated candidate-job matching.
3. Real-data candidate, recruiter, and admin pages.
4. Database-backed staking and dispute administration.
5. Streaming and cancellable public Product Q&A.
6. Deterministic test and quality gates.

On-chain settlement is not part of this implementation. Stake records are
persisted platform escrow records and must not be presented as confirmed
blockchain transactions.

## Architecture Boundaries

### Browser

- Calls only `apps/web` routes.
- Never receives the internal agent service token.
- Sends resource identifiers, not trusted resource labels or identity fields.
- Uses TanStack Query for server state.
- Uses local component state or Zustand only for UI state.

### Web

- Owns authentication, authorization, request validation, and Postgres access.
- Resolves the authenticated Shire user from Privy.
- Loads trusted candidate, recruiter, job, company, application, stake, and
  dispute context from Postgres.
- Proxies bounded, trusted requests to the agent with the internal service
  token.
- Exposes paginated and filterable APIs to authenticated pages.

### Agent

- Owns chat generation, CV parsing, matching, reranking, RAG, and model routing.
- Reads operational matching data from the shared Postgres database.
- Uses BullMQ for durable work when Redis is configured.
- Uses libSQL/Turso for agent memory and vector knowledge.
- Must not trust browser-provided identity or resource context.

### Public Landing Page

- May use static presentation data.
- Product Q&A is the only landing feature that calls the agent.
- Public Q&A cannot expose authenticated or repository-only knowledge.

## Incremental Matching

### Invariants

- A candidate-job pair has one canonical evaluation state.
- An unchanged pair is not evaluated again.
- Below-threshold and ignored outcomes are persisted as evaluations.
- A recommendation is unique per candidate, job, and audience direction.
- Closing a job or invalidating a candidate profile deactivates related
  recommendations.
- Queue retries do not create duplicate evaluations or recommendation rows.

### Matching Evaluation Record

Add a `matching_evaluations` table with:

- `id`
- `candidate_user_id`
- `job_id`
- `input_hash`
- `scoring_version`
- `status`: `PENDING`, `RUNNING`, `COMPLETED`, or `FAILED`
- `rule_score`
- `match_score`
- `confidence`
- `recommended_action`
- `reasons`
- `missing_requirements`
- `risk_flags`
- `failure_code`
- `attempt_count`
- timestamps

The unique key is `(candidate_user_id, job_id)`. The row represents the latest
known evaluation of that pair. `input_hash` is derived from normalized fields
that affect matching:

- Candidate profile status, skills, target roles, location, work preference,
  salary, and experience.
- Job status, title, description, location, remote flag, salary, type,
  experience level, required skills, and risk fields.
- Scoring and prompt version.

### Discovery and Scheduling

The 15-minute scheduler becomes a reconciliation process:

1. Load confirmed candidates and active jobs.
2. Produce candidate-job pair descriptors without calling a model.
3. Compare each pair hash with `matching_evaluations`.
4. Enqueue only missing, failed-retryable, or stale pairs.
5. Deactivate evaluations and recommendations for no-longer-eligible pairs.

Profile confirmation and job activation also request reconciliation so users do
not always wait for the next interval.

For two confirmed candidates and one active job, the first run creates at most
two pair jobs. Later runs create zero jobs until relevant data or the scoring
version changes.

### Queue Deduplication

BullMQ job IDs use:

`matching:<candidateId>:<jobId>:<inputHash>`

The in-memory queue applies the same logical deduplication contract for local
development and tests. Scheduler overlap cannot enqueue a second copy of an
existing queued, active, or completed input version.

The worker atomically claims the evaluation, evaluates the pair once, and
upserts audience-specific recommendations in one database transaction.

## Page-Aware Chat

### Client Scope

The client derives only:

- active role
- resource type
- resource ID from the route

It does not load a hardcoded job catalog and does not send a trusted label.

### Server Authorization

The web chat route resolves resource context through repositories:

- Candidate profile: authenticated candidate only.
- Candidate job: active job visible to that candidate.
- Recruiter company: authenticated recruiter profile only.
- Recruiter job: job owned by that recruiter.
- Application: candidate owner or recruiter owning the related job.

Unauthorized resources return a stable 403 response. Missing resources return a
stable 404 response. The trusted resource context includes relevant database
fields and is forwarded to the agent as system context.

### Retrieval Policy

Product knowledge retrieval is intent-gated:

- Product, policy, staking process, escrow process, and platform navigation
  questions may use product RAG.
- Candidate, job, company, or application questions primarily use trusted
  database context.
- General social messages do not perform embedding retrieval.
- Retrieval failure does not silently invent product facts.

## Real-Data Web

### Candidate

- Dashboard metrics come from jobs, applications, and recommendations APIs.
- Recommended jobs render persisted agent recommendations.
- Job detail uses the persisted pair evaluation and recommendation. It does not
  run deterministic browser-side matching with a null profile.
- Applications, profile, CV status, and stake records use authenticated APIs.

### Recruiter

- Dashboard KPI, pipeline, catalog, activity, match distribution, and reach use
  aggregated database queries.
- Job detail loads owned job, applications, and talent recommendations.
- Applicant identity summaries come from authorized candidate profile joins.
- Creating or activating a job triggers matching reconciliation.

### Admin

- Admin authorization is server enforced.
- Jobs, stakes, disputes, and platform totals use paginated APIs.
- Mutations create audit records containing actor, action, entity, reason, and
  timestamp.
- No admin action mutates a client-only store.

### Staking

- Stake creation, release, refund, and slash are database transactions.
- Repeated mutation requests are idempotent.
- Invalid state transitions return 409.
- UI copy identifies records as platform escrow until on-chain settlement is
  implemented.

### UI State

Every server-backed surface provides:

- Stable loading skeleton.
- Distinct empty state.
- Actionable error state with retry where safe.
- Disabled and idempotent mutation controls while pending.
- Query invalidation after successful mutation.
- Pagination or bounded result limits.

## Product Q&A

### Streaming Flow

1. Landing browser posts a public question to the web route.
2. Web validates length and creates an abort signal.
3. Agent classifies the request.
4. Product retrieval runs with its own timeout.
5. The model streams an answer using only public product context.
6. Web forwards SSE without buffering.
7. Browser renders safe progress events followed by answer deltas.

Raw hidden reasoning is never displayed. Reasoning signals are mapped to
bounded status text such as `Checking product policy` or
`Preparing a concise answer`.

### Cancellation and Timeouts

- Browser disconnect aborts the web upstream request.
- Web abort propagates to agent retrieval and generation.
- Retrieval and generation have separate budgets.
- Timeout paths stop provider work instead of only racing the response promise.
- The stream always terminates with a valid finish or error event.

### Cache

Normalized public questions may use a short-lived response cache. The cache key
includes the knowledge manifest version and Product Q&A model policy version.
Authenticated chat is not shared through this cache.

## Error Handling and Observability

All cross-service requests carry a correlation ID. Structured logs include:

- route and operation
- authenticated role, with no secret token
- resource type and internal ID
- queue dedup decision
- evaluation skip reason
- retrieval, model, and total duration
- provider/model telemetry
- terminal status and stable error code

Logs must not contain raw CV documents, full prompts, service tokens, or private
profile payloads.

## Test Isolation

### Default Tests

- Do not load repository `.env` credentials.
- Do not contact Redis, Postgres, Turso, embedding, or text providers.
- Inject in-memory repositories, queues, model adapters, and retrieval adapters.
- Server test helpers always provide explicit job runtime dependencies.

### Live Tests

Live Redis, database, embedding, and model tests use separate commands and
explicit opt-in environment flags. They are not imported by the default suite.

### Required Regression Coverage

- Dynamic candidate job chat scope.
- Recruiter-owned job chat scope.
- Forbidden cross-recruiter job scope.
- No RAG call for social or resource-only intent.
- Pair deduplication across scheduler runs.
- Persistence of below-threshold evaluations.
- Re-evaluation after hash changes.
- Recommendation deactivation.
- Queue overlap and retry idempotency.
- Product Q&A streaming, abort propagation, and terminal errors.
- Candidate, recruiter, and admin API authorization.
- Loading, empty, error, and mutation pending states for authenticated pages.

## Quality Gates

The implementation is complete only when:

- Web and agent typecheck pass.
- Web and agent build pass.
- ESLint runs successfully.
- Default tests make no live network calls and pass.
- Database migrations apply from a clean schema.
- Browser verification passes candidate, recruiter, admin, and landing Q&A
  critical paths.
- Authenticated source code contains no imports from demo fixtures.
- Git worktree is clean except for intentional implementation changes.

## Delivery Strategy

Implement as vertical slices with one focused commit per feature:

1. Test isolation and deterministic runtime dependencies.
2. Dynamic page-aware chat.
3. Canonical matching evaluation and queue deduplication.
4. Candidate real-data flows.
5. Recruiter dashboard and applicant real-data flows.
6. Admin, staking, disputes, and audit records.
7. Streaming Product Q&A and intent-gated RAG.
8. Full browser verification and removal of authenticated demo imports.

