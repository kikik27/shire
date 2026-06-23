# Real Matching Pipeline — Design & ADR

> Companion to 2026-06-21-agent-cleanup-security-design.md. Scope: `packages/shared`,
> `apps/web`, `apps/agent`. Onchain escrow remains out of scope.

## Decisions (confirmed during planning)

1. **Data access:** agent queries Postgres directly via its own Drizzle client
   (shared DB with web). Agent DB is optional — chat/product-Q&A keep working
   without it; only matching jobs require it.
2. **Schema:** backward-safe additions only (new columns with defaults, new
   `recommendations` table, new enums). No enum value changes, no backfill.
3. **Matching runs in the agent** (Filter → Rule Score → Rerank → persist).
4. **Anti-self-apply** uses `jobs.recruiterUserId` as the ownership proxy for
   MVP (full Company/CompanyMember model deferred).

## ADR: chat middleware stays in Express (Phase 4.2 deferred)

**Status:** Accepted — deferred.

**Context:** The matching build plan included migrating the chat guard chain
(auth → logging → validation → rate-limit → security → RAG) from Express
middleware into Mastra `server.middleware`.

**Decision:** Keep the Express middleware. Do not migrate.

**Rationale:** The RAG enrichment step mutates `request.body` to inject product
knowledge into the chat messages, which Mastra's `chatRoute` handler then
reads. Mastra middleware receives a Hono `Context` whose request body is
immutable; reconstructing the body so `chatRoute` reads the mutated version is
undocumented and fragile. The Express middleware (already clean and
well-factored in `routes/chat.middleware.ts`) does this trivially via
`request.body = enrichment.body`. Migration offers no functional gain and
carries high regression risk on the 10 chat tests. The rate limiter is a
module-level singleton shared across requests, which also composes more
naturally in Express.

The earlier brainstorm confirmed the user's preference for body mutation (over
requestContext/tool retrieval) for RAG — that preference is honored by keeping
the Express path.

**Consequence:** There remains a framework duality (Express owns chat
middleware, Mastra owns the chat route + matching agents). This is acceptable:
the Express middleware is the canonical, tested chat guard path, and Mastra is
the canonical agent/LLM orchestrator. The duality is now well-documented rather
than accidental.

## Pipeline

```
Filter (job ACTIVE, not self-owned, not applied, candidate CONFIRMED)
  → Rule Score (skill 40 / exp 20 / location 15 / salary 10 / portfolio 10 / risk 5)
  → Rerank (job-rerank / talent-rerank capability model, MatchingOutputSchema)
       fallback to rule-score-derived action on model failure
  → Persist recommendation (score >= 70; flag >= 85 as strong)
```

## Out of scope (this cycle)

- ShireEscrow.sol, OnchainEvent, onchain-sync, wagmi/viem, staking UI.
- Enum reconciliation (RECRUITER vs COMPANY, application status vs onchain).
- Company/CompanyMember tables, Dispute/Evidence tables.
- Recommendation notification transport.
- pgvector / semantic candidate retrieval.
