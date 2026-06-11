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

## Next — Wire the product (not started; backend out of scope for this pass)

### Phase 1 — Data
- [ ] `packages/db`: Prisma schema (User, CandidateProfile, Company, CompanyMember, Job,
      Recommendation, Application, Dispute, Evidence, AgentRun, OnchainEvent), client singleton, seed

### Phase 2 — Auth
- [ ] Privy / SIWE login, MiniPay detection, `/api/auth/{me,sync-user,set-active-mode}`
- [ ] Onboarding redirect when incomplete

### Phase 3 — Onboarding & modes
- [ ] `/onboarding` (Find jobs / Find talents / Both) + `select-mode` API + mode switcher

### Phase 4 — Candidate
- [ ] CV upload → parse workflow → editable AI draft → confirm profile

### Phase 5 — Company
- [ ] Create company (OWNER), company dashboard, create + activate job (Zod-validated)

### Phase 6 — Agents (apps/agent)
- [ ] Real CV / job-match / talent-match / dispute agents returning Zod-validated output + AgentRun logs

### Phase 7 — Matching
- [ ] Hard filters + anti self-apply + skill-overlap scoring → recommendations in dashboard

### Phase 8 — Contract
- [ ] `ShireEscrow.sol`: create / accept+stake / complete / refund / dispute / resolve + tests + Alfajores deploy

### Phase 9 — Wallet & staking UI
- [ ] wagmi/viem + Celo config, Apply&Stake / Accept&Stake, tx status UI

### Phase 10 — Onchain sync
- [ ] Event sync job, `OnchainEvent` dedupe, Application status follows chain

### Phase 11 — Disputes
- [ ] Open dispute, evidence upload + hash, dispute summary agent, admin resolver action

---

## Guardrails (do not break)
- [ ] No permanent `User.role = CANDIDATE/COMPANY`
- [ ] AI never signs, stakes, applies, invites, or resolves disputes
- [ ] No sensitive CV/profile data onchain
- [ ] Never recommend applying to a user's own company's job
