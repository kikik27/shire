# Shire Web2 Foundation Plan (Fase B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Prerequisite:** Fase A (cleanup-refactor) selesai.

**Goal:** Membangun fondasi fitur web2 end-to-end: auth session enforced, data layer lengkap, API routes, dan halaman terhubung ke DB. Lingkup MVP saja (auth, profile, jobs, applications). Tanpa onchain.

**Architecture:** Tambah tabel Drizzle (jobs, applications, agentRuns) + kolom user. Middleware Next.js guard route. API auth-sync (Privy → upsert user). Onboarding & mode API. Jobs/applications CRUD dengan Zod. React Query untuk data fetching di client. Stake tetap simulated (field data).

**Tech Stack:** Next.js 16 App Router, Drizzle ORM (Postgres), Privy (server verify), Zod, React Query, TypeScript strict.

**Context7 refresh wajib saat eksekusi:** Drizzle pgTable/relations/migration, Next.js 16 middleware/cookies/server actions, Privy `@privy-io/node` verifyAccessToken. Gunakan skill `test-driven-development` tiap task.

---

## File Structure (Fase B)

### Schema baru (`apps/web/lib/server/db/schema.ts`)
- `appUsers` — tambah: `walletAddress`, `email`, `userType` (pgEnum), `activeMode` (pgEnum), `onboardingDone`
- `jobs` — baru (recruiterUserId FK, title, description, requiredSkills jsonb, stakeAmount, status pgEnum, timestamps)
- `applications` — baru (jobId FK, candidateUserId FK, status pgEnum, stakeTx (simulated), timestamps)
- `agentRuns` — baru (agentName, workflowName, status, input/output jsonb, latencyMs, timestamps)

### Baru
- `apps/web/middleware.ts` — route guard
- `apps/web/lib/server/auth-session.ts` — session helper (verify + redirect logic)
- `apps/web/app/api/auth/me/route.ts`
- `apps/web/app/api/auth/sync-user/route.ts`
- `apps/web/app/api/auth/set-active-mode/route.ts`
- `apps/web/app/api/onboarding/select-mode/route.ts`
- `apps/web/app/api/recruiter/jobs/route.ts` (POST/GET)
- `apps/web/app/api/candidate/applications/route.ts` (GET)
- `apps/web/app/api/candidate/applications/[jobId]/route.ts` (POST apply)
- `apps/web/lib/server/jobs-repository.ts` — job CRUD
- `apps/web/lib/server/applications-repository.ts` — application CRUD
- `apps/web/lib/hooks/use-jobs.ts`, `use-applications.ts` — React Query hooks

### Modifikasi
- `apps/web/lib/server/db/schema.ts` — tabel + kolom baru
- `apps/web/drizzle/` — migration baru via `drizzle-kit generate`
- `apps/web/lib/server/authenticated-user.ts` — segel demo fallback (warn jelas di dev, throw di prod)
- `apps/web/lib/schemas.ts` — tambah `SelectModeSchema`, `SetActiveModeSchema`, `ApplyJobSchema` (JobCreateSchema sudah ada)
- `apps/web/app/onboarding/page.tsx` — panggil API select-mode
- `apps/web/components/layout/role-switcher.tsx` — sync ke set-active-mode API
- `apps/web/app/recruiter/jobs/new/page.tsx`, `jobs/[id]/page.tsx` — gunakan use-jobs hook
- `apps/web/app/candidate/jobs/page.tsx`, `applications/page.tsx` — gunakan use-applications hook

---

## Fase B1 — DB schema lengkap

### B1.1 Tambah kolom appUsers
- [ ] Context7: query Drizzle docs untuk pgEnum + column patterns
- [ ] Baca `apps/web/lib/server/db/schema.ts` saat ini
- [ ] Tambah pgEnum `userType` (USER, ADMIN), `userMode` (CANDIDATE, RECRUITER, BOTH)
- [ ] Tambah kolom ke `appUsers`: `walletAddress` (text unique nullable), `email` (text unique nullable), `userType` (default USER), `activeMode` (nullable), `onboardingDone` (boolean default false)
- [ ] `npx drizzle-kit generate --config=apps/web/drizzle.config.ts` — generate migration
- [ ] Cek file migration SQL yang dihasilkan, verifikasi ALTER TABLE benar
- [ ] Commit: `feat(db): add user identity columns (wallet, email, type, mode, onboarding)`

### B1.2 Tambah tabel jobs
- [ ] Tambah pgEnum `jobStatus` (DRAFT, ACTIVE, PAUSED, CLOSED)
- [ ] Definisikan `jobs` pgTable: id (uuid), recruiterUserId (FK appUsers), title, description, requiredSkills (jsonb), niceToHaveSkills (jsonb nullable), salaryRange (jsonb nullable), workType, location, stakeAmount (numeric), stakeToken (text default 'cUSD'), status (default DRAFT), timestamps. enableRLS.
- [ ] `npx drizzle-kit generate` — migration
- [ ] Commit: `feat(db): add jobs table`

### B1.3 Tambah tabel applications & agentRuns
- [ ] Definisikan `applications`: id, jobId (FK jobs), candidateUserId (FK appUsers), status (pgEnum applicationStatus CREATED, APPLIED, ACCEPTED, COMPLETED, REJECTED, CANCELLED), stakeTx (text nullable, simulated), stakeAmount (numeric nullable), timestamps. enableRLS.
- [ ] Definisikan `agentRuns`: id, agentName, workflowName (nullable), status (pgEnum SUCCESS, FAILED, PARTIAL), input (jsonb nullable), output (jsonb nullable), errorMessage (nullable), latencyMs (int nullable), timestamps.
- [ ] `npx drizzle-kit generate` — migration
- [ ] Commit: `feat(db): add applications and agent_runs tables`

### B1.4 Checkpoint
- [ ] `npm run typecheck -w @shire/web` — lulus
- [ ] Review migration SQL — relasi FK + RLS benar
- [ ] **Checkpoint: konfirmasi user sebelum B2**

---

## Fase B2 — Route protection & auth-sync API

### B2.1 Segel demo fallback
- [ ] Baca `apps/web/lib/server/authenticated-user.ts:52-59`
- [ ] Ubah: di production throw `AuthenticatedUserConfigurationError` (sudah ada), di dev kembalikan demo TAPI log warning jelas via `console.warn` (atau pino bila web punya logger)
- [ ] Update test `apps/web/test/` yang mengandalkan demo fallback — pastikan masih lulus
- [ ] Commit: `fix(web): warn on demo auth fallback in dev, forbid in prod`

### B2.2 auth-session helper
- [ ] Buat `apps/web/lib/server/auth-session.ts`: 
  - `getCurrentUser(request)`: resolve AuthenticatedUser → load appUsers row by privyUserId → return `{ user, mode, onboardingDone }` atau null
  - `requireUser(request)`: throw redirect ke `/connect` bila tidak ada session
  - `requireOnboardedUser(request)`: throw redirect ke `/onboarding` bila `onboardingDone=false`
- [ ] Context7: Next.js 16 `redirect()` dari `next/navigation` di server component / route handler
- [ ] Tulis test untuk auth-session (mock Privy verify + mock db)
- [ ] Commit: `feat(web): add auth-session server helpers`

### B2.3 middleware.ts route guard
- [ ] Context7: Next.js 16 middleware, `NextResponse.redirect`, matcher config
- [ ] Buat `apps/web/middleware.ts`: matcher `/candidate/:path*, /recruiter/:path*, /admin/:path*, /dashboard/:path*`
- [ ] Middleware baca session token (cookie/header), bila tidak ada → redirect `/connect?next=<path>`
- [ ] Catatan: middleware Edge runtime — tidak bisa pakai Drizzle/Node libs. Cukup cek token presence; otorisasi penuh di server component/route.
- [ ] Commit: `feat(web): add middleware route guard for protected paths`

### B2.4 API auth/me, sync-user, set-active-mode
- [ ] `apps/web/app/api/auth/me/route.ts` GET — return current user (resolve + load row)
- [ ] `apps/web/app/api/auth/sync-user/route.ts` POST — upsert user by privyUserId, link walletAddress/email bila ada di Privy claims, return user
- [ ] `apps/web/app/api/auth/set-active-mode/route.ts` POST — Zod `SetActiveModeSchema`, update `activeMode`, return user
- [ ] Tambah `SetActiveModeSchema` ke `apps/web/lib/schemas.ts`
- [ ] Tulis test untuk tiap route (mock auth + db)
- [ ] Commit: `feat(web): add auth me/sync-user/set-active-mode API routes`

### B2.5 Checkpoint
- [ ] `npm run typecheck -w @shire/web` — lulus
- [ ] `npm test -w @shire/web` — lulus
- [ ] Manual: akses `/recruiter` tanpa login → redirect `/connect`
- [ ] **Checkpoint: konfirmasi user sebelum B3**

---

## Fase B3 — Onboarding & mode

### B3.1 API select-mode
- [ ] `apps/web/app/api/onboarding/select-mode/route.ts` POST — Zod `SelectModeSchema` (CANDIDATE/RECRUITER/BOTH)
- [ ] Logic: set `activeMode`, create empty candidate/recruiter profile draft bila CANDIDATE/BOTH, set `onboardingDone=true`, return redirect target
- [ ] Tambah `SelectModeSchema` ke `apps/web/lib/schemas.ts`
- [ ] Tulis test
- [ ] Commit: `feat(web): add onboarding select-mode API`

### B3.2 Onboarding page → API
- [ ] Baca `apps/web/app/onboarding/page.tsx` — saat ini static picker
- [ ] Ganti: tombol mode trigger POST `/api/onboarding/select-mode` dengan access token, lalu `router.push` ke redirect target
- [ ] Commit: `feat(web): wire onboarding page to select-mode API`

### B3.3 Mode switcher sync
- [ ] Baca `apps/web/components/layout/role-switcher.tsx`
- [ ] Saat switch, panggil `/api/auth/set-active-mode` (bukan hanya mutasi Zustand)
- [ ] Commit: `feat(web): sync role switcher to set-active-mode API`

### B3.4 Checkpoint
- [ ] `npm run typecheck -w @shire/web` — lulus
- [ ] Manual: login → onboarding → pilih mode → dashboard, `activeMode` persist di DB
- [ ] **Checkpoint: konfirmasi user sebelum B4**

---

## Fase B4 — Jobs & Applications API

### B4.1 jobs-repository
- [ ] Buat `apps/web/lib/server/jobs-repository.ts` mengikuti pattern `profile-repository.ts` (interface + impl + DI)
- [ ] Method: `createJob(recruiterUserId, input)`, `listJobsByRecruiter(userId)`, `listActiveJobs()`, `getJob(id)`, `updateJobStatus(id, status)`
- [ ] Tulis test (mock db / in-memory impl)
- [ ] Commit: `feat(web): add jobs repository`

### B4.2 API recruiter/jobs
- [ ] `apps/web/app/api/recruiter/jobs/route.ts` POST — Zod `JobCreateSchema` (sudah ada di schemas.ts) → `jobsRepository.createJob` → set status DRAFT/ACTIVE
- [ ] GET — `jobsRepository.listJobsByRecruiter(currentUser)`
- [ ] `apps/web/app/api/recruiter/jobs/[id]/route.ts` GET/PATCH
- [ ] Tulis test
- [ ] Commit: `feat(web): add recruiter jobs API routes`

### B4.3 applications-repository + API
- [ ] Buat `apps/web/lib/server/applications-repository.ts`: `applyToJob(candidateUserId, jobId, stakeAmount?)`, `listApplicationsByCandidate(userId)`, `listApplicationsByJob(jobId)`, `updateApplicationStatus(id, status)`
- [ ] Anti self-apply: `applyToJob` cek job.recruiterUserId !== candidateUserId, throw bila sama
- [ ] `apps/web/app/api/candidate/applications/route.ts` GET
- [ ] `apps/web/app/api/candidate/applications/[jobId]/route.ts` POST apply — Zod `ApplyJobSchema`
- [ ] Tulis test (termasuk anti self-apply)
- [ ] Commit: `feat(web): add applications repository and candidate apply API`

### B4.4 Hook halaman ke API
- [ ] Buat `apps/web/lib/hooks/use-jobs.ts` (React Query): `useJobs()`, `useCreateJob()`, `useJob(id)`
- [ ] Buat `apps/web/lib/hooks/use-applications.ts`: `useMyApplications()`, `useApplyJob()`
- [ ] Refactor `apps/web/app/recruiter/jobs/new/page.tsx` — ganti `useShireStore(s=>s.createJob)` → `useCreateJob()` mutation
- [ ] Refactor `apps/web/app/recruiter/jobs/[id]/page.tsx` + `jobs/page.tsx` → `useJobs()`
- [ ] Refactor `apps/web/app/candidate/jobs/page.tsx` + `applications/page.tsx` → hooks
- [ ] Pertahankan loading/empty/error state (sudah ada komponennya)
- [ ] Commit: `feat(web): wire recruiter/candidate job pages to API via React Query`

### B4.5 Checkpoint
- [ ] `npm run typecheck -w @shire/web` — lulus
- [ ] `npm test -w @shire/web` — lulus
- [ ] Manual E2E: recruiter create job (DB) → candidate list jobs → apply → lihat di applications
- [ ] **Checkpoint: konfirmasi user sebelum B5**

---

## Fase B5 — Hubungkan sisa halaman + final

### B5.1 Dashboard & admin dari DB
- [ ] `apps/web/app/recruiter/page.tsx` — stat cards dari `useJobs()` + `useApplications()` (count), bukan store
- [ ] `apps/web/app/candidate/page.tsx` — dari hooks
- [ ] `apps/web/app/admin/*` — baca dari DB via server component (admin-only check via userType)
- [ ] Commit: `feat(web): drive dashboard and admin pages from database`

### B5.2 Kurangi demo fixtures
- [ ] Identifikasi fixtures yang sekarang sudah digantikan API (`lib/seed.ts` jobs/applications untuk live data)
- [ ] Pertahankan seed HANYA untuk: empty-state preview, marketing, onboarding demo
- [ ] Hapus seed data transaksional yang sudah ada di DB (tapi simpan untuk test seed script)
- [ ] Commit: `refactor(web): reduce demo fixtures to empty-state and marketing only`

### B5.3 Final review Fase B
- [ ] `npm run typecheck` (root) — lulus
- [ ] `npm run build -w @shire/web` — lulus
- [ ] `npm run build -w @shire/agent` — lulus
- [ ] `npm test -w @shire/web` + `@shire/agent` — lulus
- [ ] Manual full E2E: login Privy → onboarding → recruiter buat job → switch candidate → apply → lihat applications → admin lihat semua. Tanpa onchain.
- [ ] Update `tasks.md`: Fase B `[x]`
- [ ] **Final checkpoint: Fase B selesai. Onchain/staking siklus berikutnya.**

---

## Out of scope (siklus onchain)
- ShireEscrow.sol, wagmi provider, staking tx nyata, onchain sync, dispute/evidence, 3 domain agent, matching pipeline, scheduler.
