# Shire — Architecture

> High-level, current-state architecture. The exhaustive product/domain spec (DB schema,
> contract design, staking flow, agent orchestration, route map, security rules) lives in
> [`.agent/context/architecture.md`](.agent/context/architecture.md) and the per-domain docs
> under `.agent/context/`. This file is the orientation layer; that one is the source of truth.

## 1. Product in one paragraph

Shire is an AI-powered hiring marketplace with stablecoin escrow on Celo. A single
wallet-based identity can find work (candidate), find talent (company/agency), or both.
AI finds and drafts; the human approves; a smart contract locks and settles stake.

```
AI finds. User approves. Stake locks. Workflow validates. Resolver decides. Contract settles.
```

## 2. System shape

```
                ┌───────────────────────────────┐
   Browser /    │          apps/web             │   Next.js 16 (App Router, RSC)
   MiniPay  ───▶│  Marketing · Dashboard · API  │   Tailwind v4 + shadcn/ui
                │  Server Actions · Wallet UI    │
                └───────┬───────────────┬────────┘
                        │               │
         Privy / SIWE   │               │  wagmi + viem
         session        ▼               ▼
                ┌───────────────┐  ┌───────────────────┐
                │  PostgreSQL   │  │   Celo network    │
                │  Prisma ORM   │  │  ShireEscrow.sol  │
                └──────┬────────┘  └─────────┬─────────┘
                       │                     │
                       ▼                     │ events
                ┌───────────────────────────┴────────┐
                │            apps/agent               │  Mastra orchestration
                │ CV parse · matching · disputes ·    │  deterministic workflows
                │ onchain sync (scheduled + on-demand)│  + structured (Zod) output
                └─────────────────────────────────────┘
```

## 3. Workspaces

| Workspace | Stack | Responsibility |
|---|---|---|
| `apps/web` | Next.js 16, React 19, TS, Tailwind v4, shadcn/ui, recharts, wagmi/viem (planned) | UI, API routes, server actions, wallet + onchain status, dashboards |
| `apps/agent` | Mastra, Zod, tsx | Agent definitions, deterministic workflows, runnable jobs, local server |
| `contracts` | Foundry, Solidity | `ShireEscrow.sol`, tests, deploy scripts |

The deep spec also describes future `packages/{db,shared,ai-context,contracts,ui}`; those are
**not yet created** — the repo is intentionally lean until the data layer lands.

## 4. Frontend architecture (current focus)

The web app is built **frontend-first** with realistic demo data so the full experience is
visible before backend wiring.

### Rendering
- **RSC by default.** Client components are opt-in (`"use client"`) and isolated to
  interactive widgets: charts, dropdowns, the theme toggle, the mobile nav sheet.
- The marketing page and dashboard shell are server components composing small client leaves.

### Styling & theming
- Tailwind v4 CSS-first config; **no `tailwind.config.js`**. Design tokens are OKLCH CSS
  variables in `app/globals.css` (`:root` light, `.dark` navy), mapped through `@theme inline`.
- shadcn/ui primitives in `components/ui/` (owned, editable). One icon set (`lucide-react`).
- Brand: blue/indigo fintech. See [`brand.md`](brand.md).

### Composition
```
app/
  page.tsx                    marketing landing — composes components/marketing/*
  dashboard/(layout+page)     authed shell — composes components/dashboard/*
components/
  marketing/  navbar hero logos stats steps features testimonials integrations pricing faq cta footer
  dashboard/  sidebar topbar stat-cards talent-reach catalog-table activity-chart match-donut pipeline-overview pipeline-lists
  ui/         shadcn primitives
  site/       logo, theme-provider
lib/          cn() + typed demo data (candidates, jobs, applications, chart series)
```

### Data (today)
All screens render from typed fixtures in `lib/` — no network. This keeps the UI honest about
loading/empty/error states (each list/table implements them) while the API is built.

## 5. Identity & access (from the spec)

- No permanent `role` on `User`. `userType` is only `USER | ADMIN`.
- `CandidateProfile` is optional; a user can own many `Company`s via `CompanyMember`.
- `activeMode` (`CANDIDATE | COMPANY | BOTH`) only changes UI context, not permissions.
- Stake role (`applicant` / `company`) is per-application, enforced onchain.

## 6. Backend & chain (planned — see `.agent/context`)

- **Auth:** Privy / SIWE on web, wallet session in MiniPay; normalize to one `User`.
- **Data:** PostgreSQL + Prisma. Matching is rule-based (skill overlap) for MVP, pgvector later.
- **Agent:** Mastra workflows for CV parse, job/talent matching, dispute summary, onchain sync.
- **Chain:** `ShireEscrow.sol` on Celo Alfajores — create/accept/complete/refund/dispute/resolve
  with `ReentrancyGuard` and resolver-only settlement.

## 7. Build & tooling

- npm workspaces + **Turborepo** (`turbo.json`): `dev`, `build`, `lint`, `typecheck`.
- TypeScript strict, `moduleResolution: Bundler`, shared base in `tsconfig.base.json`.

## 8. Roadmap

Phased plan (DB → auth → onboarding → candidate → company → agents → matching → contract →
staking UI → onchain sync → disputes) is in `.agent/context/architecture.md` §28 and tracked
in [`tasks.md`](tasks.md).
