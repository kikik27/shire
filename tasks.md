# Tasks

Working tracker. Source of phased detail: `.agent/context/architecture.md` §28.

Legend: `[x]` done · `[~]` in progress · `[ ]` todo

---

## Now — Frontend build (apps/web)

### Foundation
- [x] Tailwind CSS v4 + PostCSS wired into the Next 16 app
- [x] shadcn/ui (new-york) installed — button, card, badge, accordion, avatar, table, tabs,
      separator, input, label, dropdown-menu, sheet, scroll-area, progress, tooltip, chart, skeleton
- [x] Brand token system (OKLCH light + dark) in `app/globals.css` + `brand.md`
- [x] `next/font` (Inter + JetBrains Mono), theme provider, root metadata
- [x] Typed demo data in `lib/` for all screens

### Marketing landing (`/`)
- [x] Sticky navbar with blur + mobile sheet menu
- [x] Hero (dark band): copilot prompt mock, mode toggle, suggested chips, trust cluster
- [x] Trust logos row
- [x] Stats band
- [x] "Get started in 3 steps"
- [x] AI features grid
- [x] Testimonials
- [x] Integrations / workflow section
- [x] Pricing (Free / Pro)
- [x] FAQ accordion
- [x] Final CTA band + footer
- [x] Responsive 375 / 768 / 1280; reduced-motion safe; AA contrast pass

### Dashboard (`/dashboard`)
- [x] Sidebar (icon nav) + topbar (search, notifications, theme toggle, user)
- [x] KPI stat cards (active applications, pending stakes, match rate, time-to-hire)
- [x] Talent reach panel + job/application catalog table (with empty/loading states)
- [x] Application activity area chart + match-quality donut
- [x] Pipeline overview bar chart + candidate/company action lists
- [x] Footer bar

### Verify
- [x] `npm run typecheck -w @shire/web`
- [x] `npm run build -w @shire/web`
- [ ] Manual pass in browser at all breakpoints + dark mode (needs a human / preview)

---

## Next — Add new capability (see `.agent/context/architecture.md` §28 for full detail)

> The repo already has a real Drizzle/Postgres schema, Privy auth, API routes, and a working
> Mastra agent runtime (see root `README.md`) — that's the MVP baseline. The 3 phases below
> add new capability on top of it, they don't restate what already exists.

### Phase 1 — Complete the web2 product surface
- [ ] Close remaining gaps in onboarding, candidate, and company flows
- [ ] Harden the Mastra agent pipeline (CV profile, job matching, talent matching, dispute
      summary) and the matching/recommendation loop
- [ ] Applications can reach an "agreed" state using the existing DB-tracked (simulated) stake

### Phase 2 — Stellar/Soroban chain foundation
- [ ] `ShireEscrow` (Soroban/Rust): create / accept+stake / complete / refund / dispute /
      resolve + tests + Stellar testnet deploy
- [ ] Stellar Wallets Kit wallet connector (Freighter, xBull, Albedo, Lobstr) alongside Privy
      (Privy stays login/identity only)
- [ ] Apply & Stake / Company Accept & Stake UI against the deployed contract, tx status UI

### Phase 3 — Chain-dependent features
- [ ] Onchain sync: Soroban `getEvents` polling, `OnchainEvent` dedupe, Application status
      follows chain
- [ ] Disputes: evidence upload + hash (hash onchain), dispute-summary agent wired to real
      disputes, admin resolver action calling `resolve_dispute`

---

## Guardrails (do not break)
- [ ] No permanent `User.role = CANDIDATE/COMPANY`
- [ ] AI never signs, stakes, applies, invites, or resolves disputes
- [ ] No sensitive CV/profile data onchain
- [ ] Never recommend applying to a user's own company's job
