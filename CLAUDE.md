# CLAUDE.md

Guidance for Claude Code (and humans) working in this repository.

## What Shire is

Shire is an **AI-powered hiring marketplace with stablecoin escrow on Celo**. One wallet =
one identity that can act as a **candidate**, a **company/agency**, or **both** at once.

```
AI finds jobs and talent → User approves the important moves →
Stablecoin escrow on Celo locks the stake → Resolver settles → Contract pays out
```

The AI **finds and drafts**; it never logs in, stakes, signs, applies, invites, or resolves
disputes on the user's behalf. Those are always explicit human actions.

## Monorepo layout

npm workspaces + Turborepo. Node ≥ 20.

| Path | What it is |
|---|---|
| `apps/web` | Next.js 16 (App Router, React 19) product app + marketing site + dashboard. **Frontend is the current focus.** |
| `apps/agent` | Mastra agent service — CV parse, job/talent matching, dispute summaries, onchain sync. Deterministic workflows + stub tools today. |
| `contracts` | Foundry / Solidity workspace — `ShireEscrow.sol`. |
| `.agent/` | Deep product + domain context (source of truth). Start at `.agent/context/architecture.md`. |
| `docs/` | Design specs and implementation plans. |

## Commands

Run from the repo root:

```bash
npm run dev         # turbo: all apps in dev
npm run build       # turbo: build all
npm run lint        # turbo: lint all
npm run typecheck   # turbo: typecheck all
```

Scope to one app:

```bash
npm run dev   -w @shire/web      # Next dev server  → http://localhost:3000
npm run build -w @shire/web
npm run typecheck -w @shire/web
npm test      -w @shire/agent    # node --test
```

## Frontend stack & conventions (`apps/web`)

- **Next.js App Router + TypeScript**, React Server Components by default; add `"use client"`
  only for interactivity (charts, menus, toggles, the mobile nav).
- **Tailwind CSS v4** (CSS-first, no `tailwind.config`) + **shadcn/ui** (new-york style).
  Component source lives in `components/ui/` — owned by us, edit freely.
- **Theming via shadcn CSS variables** in `app/globals.css`. Light + dark are both defined.
  **Use semantic tokens** (`bg-background`, `text-muted-foreground`, `bg-primary`) — never
  hardcode hex or `bg-white`/`text-black`. See `brand.md` (repo root) for the palette.
- **Icons:** `lucide-react`, one library only. **Charts:** `recharts` via `components/ui/chart`.
- **Fonts:** `next/font` (Inter sans, JetBrains Mono for numbers) wired in `app/layout.tsx`.
- Marketing dark bands (hero, CTA, pricing) wrap content in `className="dark"` to flip tokens
  locally instead of hardcoding navy.
- Path aliases: `@/*` → `apps/web/*`.

### Where things live

```
apps/web/
  app/
    page.tsx                 # marketing landing (sectioned)
    dashboard/               # authenticated recruiter/candidate dashboard
      layout.tsx             # sidebar + topbar shell
      page.tsx
    layout.tsx  globals.css
  components/
    ui/                      # shadcn primitives
    marketing/               # landing sections (navbar, hero, features, pricing, …)
    dashboard/               # dashboard widgets (sidebar, stat-cards, charts, tables, …)
    site/                    # shared (logo, theme-provider)
  lib/                       # utils (cn), static demo data
```

## Design rules (non-negotiable)

The `frontend-design-guidelines` skill is authoritative. The ones that get skipped most:

1. Real `<button>`/`<a>`, never `<div onClick>`. Visible `focus-visible` ring on everything.
2. Loading / empty / error states exist for anything data-driven (skeletons over spinners).
3. Tokens, not magic numbers. Contrast passes WCAG AA. Dark mode must render correctly.
4. Animations are property-scoped, ≤ 500ms, and respect `prefers-reduced-motion`.
5. Numbers that display/change use `font-mono tabular-nums`.

## Current status

**Frontend-only build in progress.** The marketing landing page and the dashboard UI are
implemented with realistic demo data (`lib/`). No auth, API, wallet, or DB wiring yet — those
follow the phased plan in `.agent/context/architecture.md` (§28) and `tasks.md`.

## Library docs

Per the global rule, use the **Context7 MCP** for current library/framework/CLI docs
(Next.js, Tailwind v4, shadcn, recharts, viem/wagmi, Prisma, Mastra) before relying on memory.
