# Shire

Shire is an AI-assisted hiring marketplace monorepo built around three core surfaces:

- a public web product for candidates and companies
- an autonomous-but-guardrailed agent runtime for CV parsing, matching, and dispute support
- a smart contract layer for stablecoin-based escrow on Celo

The repository is structured for product development first, with agent context and workflow contracts kept explicit so the system stays auditable and does not drift into vague behavior.

## Why Shire

Shire is being designed to solve a narrow, practical problem:

- help candidates turn raw CV data into structured profiles
- help companies match talent with explicit scoring and traceable reasoning
- support dispute summarization and operational review
- settle marketplace flows with stablecoins on Celo instead of speculative token flows

## Architecture

```mermaid
flowchart LR
    User[Candidates and Companies] --> Web[apps/web<br/>Next.js web app]
    Web --> Agent[apps/agent<br/>Mastra orchestration runtime]
    Agent --> Workflows[CV parsing<br/>Job matching<br/>Talent matching<br/>Dispute summary]
    Web --> Postgres[(Shared Postgres)]
    Agent --> Postgres
    Agent --> Redis[(Redis and BullMQ)]
    Agent --> Turso[(Turso memory and knowledge)]
    Web --> Contracts[contracts<br/>Celo stablecoin escrow]
    Agent -. settlement sync .-> Contracts
```

## Monorepo Layout

```mermaid
flowchart TD
    Root[shire]
    Root --> Web[apps/web]
    Root --> Agent[apps/agent]
    Root --> Contracts[contracts]
    Root --> Context[.agent]
    Root --> Scripts[scripts]

    Agent --> AgentMastra[src/mastra]
    Agent --> AgentJobs[src/jobs]
    Agent --> AgentRuntime[src/runtime]
    Agent --> AgentTests[test]

    Context --> ContextAgent[context/agent]
    Context --> ContextAuth[context/auth]
    Context --> ContextOnchain[context/onchain]
    Context --> ContextSchemas[context/schemas]
```

## Current Scope

### Web

`apps/web` is the public product surface. It is currently a Next.js app inside the monorepo and is intended to become the main interface for candidate onboarding, company flows, and hiring marketplace operations.

### Agent

`apps/agent` is the orchestration runtime. It currently includes:

- domain agents for CV profile, job matching, talent matching, and dispute summary
- deterministic workflow boundaries for `extract -> normalize -> interpret`
- Postgres-backed matching evaluation and recommendation persistence
- BullMQ jobs with Redis-backed retries and deduplication
- Turso-backed conversation memory and product knowledge vectors
- guardrails for `manual`, `semi-autonomous`, and `fully-autonomous` operating modes
- structured runtime logging with `pino` and `pino-pretty`

### Contracts

`contracts` is the Solidity workspace. The current direction is stablecoin escrow on Celo. Onchain sync from the agent is intentionally deferred until the web and data flows are more mature.

### Agent Context

`.agent` contains the repository context used to keep agent behavior grounded:

- architecture and process rules
- agent workflow and orchestration docs
- auth context
- onchain context
- shared domain schemas

This is the source of truth for reducing hallucination and keeping the runtime aligned with product intent.

## Local Development

### Prerequisites

- Node.js `20+`
- npm `11+`

### Install

```bash
npm install
```

### Run the Monorepo

```bash
npm run dev
```

The root dev command starts:

- `apps/web`
- `apps/agent`

Note:

- the root dev command uses a small Node orchestrator in [`scripts/dev.mjs`](scripts/dev.mjs) instead of Turbo for persistent dev processes on this Windows environment
- the agent runtime defaults to port `3010`
- the web app typically uses Next.js default dev behavior on port `3000`

### Build

```bash
npm run build
```

The default build covers the web and agent workspaces. Solidity remains an
explicit Foundry command:

```bash
npm run build:contracts
```

### Typecheck

```bash
npm run typecheck
```

### Verify

```bash
npm run verify
```

This runs lint, typecheck, deterministic web and agent tests, and production
builds. It does not call live model, Redis, or Foundry tests.

## Agent Runtime

The agent runtime can be started on its own:

```bash
npm run dev --workspace=@shire/agent
```

The service exposes a simple health endpoint:

```text
GET /health
GET /ready
```

Default environment template:

- [apps/agent/.env.example](apps/agent/.env.example)

Key runtime settings:

- `PORT`
- `SHIRE_AUTONOMY_MODE`
- `SHIRE_LOG_LEVEL`
- `SHIRE_PRETTY_LOGS`
- `SHIRE_MODEL`
- `OPENAI_API_KEY`

## Agent Jobs

The agent workspace includes runnable job entrypoints for isolated workflow testing:

```bash
npm run job:cv-parse --workspace=@shire/agent
npm run job:job-matching --workspace=@shire/agent -- <candidate-user-id>
npm run job:talent-matching --workspace=@shire/agent -- <job-id>
npm run job:dispute-summary --workspace=@shire/agent
```

The HTTP runtime schedules canonical candidate/job pairs every 15 minutes.
Completed pairs with unchanged input hashes are skipped. Redis job IDs and
database uniqueness constraints prevent duplicate queue work and duplicate
recommendations.

## Production Data Model

- `apps/web` owns the shared Postgres schema and Drizzle migrations.
- `apps/agent` reads eligible profiles and active jobs, then writes matching
  evaluations, recommendations, and agent run records to the same database.
- Redis is required in production for durable jobs, retries, result polling,
  and scheduler deduplication. The in-memory queue is development-only.
- Turso/libSQL conversation memory is independent from Postgres product data.
- Turso/libSQL product knowledge stores vectors and the content-hash manifest.
  Embeddings run during knowledge sync and semantic retrieval, not on every
  request when retrieval is unnecessary.
- Authenticated profile, job, application, stake, and recommendation data is
  never persisted in browser local storage.

## Contract Development

The Solidity workspace lives in:

- [contracts](contracts)

The current contract direction is:

- marketplace escrow
- stablecoin settlement
- Celo deployment target

This repository is not positioning onchain staking as the primary product path.
The current web flow records platform escrow state in Postgres. It does not
prove that funds have settled on Celo. Contract settlement and chain
reconciliation remain a separate operational step.

## Testing

Default verification:

```bash
npm run test
npm run verify
```

Live integrations remain opt-in:

```bash
npm run test:live:llm --workspace=@shire/agent
npm run test:live-queue --workspace=@shire/agent
npm run test:contracts
```

The agent tests cover:

- env parsing
- autonomy guardrails
- CV parsing pipeline
- runtime bootstrap
- server health behavior
- tool contracts
- workflow stability

## Roadmap

Near-term priorities:

- complete Celo settlement and reconciliation for platform escrow records
- add production observability for queue lag and provider failures
- refine the public product UX and marketplace flows

## Contributing

This repository is still in active build mode. Until a dedicated contributor guide is added, keep contributions aligned with these rules:

- preserve clear workspace boundaries
- keep agent behavior explicit and auditable
- prefer deterministic workflow contracts at system boundaries
- update `.agent` context when product assumptions change

## Repository Context

If you are working inside this codebase with an AI coding agent, start here:

- [.agent/README.md](.agent/README.md)
- [.agent/context/README.md](.agent/context/README.md)

## License

No license file is published yet in this repository.

