# Shire

Shire is an AI-assisted hiring marketplace monorepo built around three core surfaces:

- a public web product for candidates and companies
- an autonomous-but-guardrailed agent runtime for CV parsing, matching, and dispute support
- a smart contract layer for stablecoin-based escrow on Stellar (Soroban)

The repository is structured for product development first, with agent context and workflow contracts kept explicit so the system stays auditable and does not drift into vague behavior.

## Why Shire

Shire is being designed to solve a narrow, practical problem:

- help candidates turn raw CV data into structured profiles
- help companies match talent with explicit scoring and traceable reasoning
- support dispute summarization and operational review
- settle marketplace flows with stablecoins on Stellar instead of speculative token flows

## Stellar Wallet Integration

The web app integrates a Stellar wallet layer (`@stellar/freighter-api`) that
also acts as the sign-in method. Connecting a Freighter wallet signs a timestamped
challenge, the server verifies the ed25519 signature (`@stellar/stellar-sdk`),
and a session cookie is issued — so "connect wallet" **is** the login. There is
no separate email/social login; the Stellar wallet is the sole identity layer.

What the wallet layer provides:

- **Connect Wallet** — Freighter permission flow (`requestAccess`) returning the public key.
- **Address retrieval** — the connected `G...` address is shown in the header menu and connect page.
- **Balance** — native XLM balance is read from Horizon and shown in the wallet menu.
- **Testnet faucet** — one-click `Claim test XLM` via Friendbot, funded to the connected address.
- **Signing** — `signMessage` (proof-of-ownership) and `signTransaction` (XDR) demos.

All API routes resolve the signed-in user from the `shire_session` cookie via a
single server-side chokepoint (`resolveAuthenticatedUser`).

### Screenshots

**Wallet connected + balance (Stellar Testnet):**
the connect page shows the connected `G...` address; opening the wallet menu
shows the XLM balance funded by Friendbot.

![Wallet connected with XLM balance](docs/assets/wallet-connected.png)

> The wallet menu popup exposes the address, the XLM balance, the faucet action,
> and the signing tabs — all gated behind a connected Freighter wallet.

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
    Web --> Contracts[contracts<br/>Stellar/Soroban stablecoin escrow]
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

`contracts` is the Soroban (Rust/WASM) workspace. The current direction is stablecoin escrow on Stellar. Onchain sync from the agent is intentionally deferred until the web and data flows are more mature.

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
- **Freighter** browser extension (for the Stellar wallet features — install from [freighter.app](https://freighter.app), then set its network to **Testnet**)
- PostgreSQL (the web app owns the schema; see `apps/web/.env.example`)

### Install

```bash
npm install
```

### Environment

Copy the env templates and fill in the required values:

```bash
cp apps/web/.env.example apps/web/.env
cp apps/agent/.env.example apps/agent/.env
```

For the Stellar wallet / sign-in flow you need at least:

```bash
# apps/web/.env
NEXT_PUBLIC_STELLAR_NETWORK=TESTNET
NEXT_PUBLIC_STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
NEXT_PUBLIC_STELLAR_FRIENDBOT_URL=https://horizon-testnet.stellar.org/friendbot

# HMAC secret for the "Sign in with Stellar" session cookie
SESSION_SECRET=node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
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

#### Trying the Stellar wallet flow

1. Open `http://localhost:3000/connect`.
2. Click **Connect Stellar Wallet** — Freighter asks for permission; approve it.
3. Freighter then prompts you to sign a sign-in challenge — approve it to create
   the session.
4. You're redirected to the dashboard. Click the wallet chip in the header to
   open the wallet menu popup.
5. On the **Faucet** tab, click **Claim test XLM** — Friendbot funds your
   address and the XLM balance appears.
6. On the **Signing** tab, try **Sign message** / **Sign transaction** to see
   the wallet's signing capability.

### Build

```bash
npm run build
```

The default build covers the web and agent workspaces. Soroban remains an
explicit Cargo command:

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
builds. It does not call live model, Redis, or Soroban tests.

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

The Soroban (Rust/WASM) workspace lives in:

- [contracts](contracts)

`ShireEscrow` ([contracts/shire-escrow](contracts/shire-escrow)) implements the marketplace
escrow: `create_application`, `company_accept_and_stake`, `mark_completed` /
`confirm_completed`, `refund_expired`, `open_dispute`, `resolve_dispute`, settled in a
stablecoin (any Stellar Asset Contract, e.g. USDC). It is deployed to Stellar testnet:

```
CDQUMSY3F4NWYZXDCQKSMP6SYK5CLY4L67M335BWFAH32SWTG3W2I5ZQ
```

initialized with the `shire-deployer` testnet key as the interim dispute resolver — replace
that with a real resolver identity before any mainnet deploy.

This repository is not positioning onchain staking as the primary product path.
The current web flow still records platform escrow state in Postgres and is not yet wired to
call the deployed contract. It does not prove that funds have settled on Stellar. UI
integration (wallet connector, stake calls, tx status) and chain reconciliation remain
separate steps — see `tasks.md` Phase 2/3.

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

- complete Stellar/Soroban settlement and reconciliation for platform escrow records
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

