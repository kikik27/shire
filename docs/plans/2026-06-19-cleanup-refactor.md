# Shire Cleanup & Refactor Plan (Fase A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membersihkan codebase dari dead code, meng-unifikasi duplikasi, dan merapikan struktur — tanpa mengubah perilaku yang dilihat user.

**Architecture:** Fase cleanup murni. Hapus web3 plumbing yang tidak terpakai (wagmi config, lib/contracts, agent onchain-sync stub), unifikasi sumber data demo & type duplikat, rapikan stake sebagai domain data "simulated", dan unifikasi path tulis profile recruiter/candidate. Semua perubahan harus lulus typecheck + test yang ada.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Tailwind v4, shadcn/ui, Zustand, Drizzle ORM, Mastra (agent). Tidak menambah dependency baru.

**Decisions locked (dari user):**
- Web2-first: pertahankan Privy, onchain/staking defer ke siklus berikutnya.
- Konsep domain "stake" dipertahankan sebagai data DB/state, BUKAN dihapus. Hanya "web3 plumbing" (wagmi/ABI/onchain-sync) yang dihapus.
- Model: pertahankan `recruiter` (1 profile/user, route `/recruiter/*`), update spec.
- ORM: Drizzle (bukan Prisma). Tidak buat `packages/*`.

---

## File Structure (Fase A)

### Yang dihapus
- `apps/web/lib/contracts/abis.ts` — orphaned ABI
- `apps/web/lib/contracts/index.ts` — orphaned contract registry
- `apps/web/lib/wallet/config.ts` — wagmi createConfig dead; sisa helper dipindah
- `apps/agent/src/runtime/jobs/onchain-sync.processor.ts` — stub no-op
- `apps/agent/src/jobs/run-onchain-sync.ts` — CLI stub
- `apps/web/store/initial-data.ts` — thin wrapper (setelah import direct)
- `apps/web/lib/store.ts` — barrel 1-baris (setelah import direct)

### Yang dimodifikasi
- `apps/web/lib/wallet/use-wallet.ts` — inline helper chain yang dipakai
- `apps/web/package.json` — hapus `wagmi` dep (jika 0 import setelahnya)
- `apps/agent/package.json` — hapus script `job:onchain-sync`
- `apps/agent/src/runtime/jobs/job-contracts.ts` — hapus varian `onchain-sync` dari discriminated union
- `apps/agent/src/runtime/jobs/job-processors.ts` — hapus dispatch onchain-sync
- `apps/web/lib/seed.ts` — single source; hapus `seedNotifications` orphaned
- `apps/web/lib/dashboard-data.ts` — derive dari seed; hapus duplikat type
- `apps/web/store/index.ts` — import langsung dari `lib/seed.ts`
- 27 file import site `@/lib/store` → `@/store`
- `apps/web/lib/types.ts` — satu-sumber JobStatus/Notification
- `apps/web/components/stake/stake-history-card.tsx` — simulated badge
- `apps/web/store/utils.ts` — hapus `randomTx()`
- `apps/web/lib/server/profile-repository.ts` — tambah `upsertProfileWithMetrics`
- `apps/web/lib/server/profile-route.ts` — hapus fork paralel `saveRecruiterProfileAtomically`
- `apps/web/.env.example` (atau root) — lengkap
- `vercel.json`, `apps/web/vercel.json` — samakan
- `architecture.md`, `tasks.md`, `.agent/decisions/log.md` — update

---

## Fase A1 — Hapus dead code web3 plumbing

### A1.1 Hapus lib/contracts (orphaned)
- [ ] Verifikasi 0 import `lib/contracts` di seluruh `apps/web/{app,components,lib}` (grep `from "@/lib/contracts"` dan `from "../contracts"`)
- [ ] Hapus `apps/web/lib/contracts/abis.ts`
- [ ] Hapus `apps/web/lib/contracts/index.ts`
- [ ] Hapus direktori `apps/web/lib/contracts/` jika kosong
- [ ] `npm run typecheck -w @shire/web` — harus lulus
- [ ] Commit: `refactor(web): remove orphaned lib/contracts web3 ABIs`

### A1.2 Hapus wagmi config dead code
- [ ] Baca `apps/web/lib/wallet/config.ts` — identifikasi helper yang dipakai `use-wallet.ts` (`DEFAULT_CHAIN`, `chainName`)
- [ ] Baca `apps/web/lib/wallet/use-wallet.ts` — konfirmasi hanya pakai helper tsb
- [ ] Inline `DEFAULT_CHAIN`/`chainName` ke `use-wallet.ts` (sebagai konstanta lokal sederhana), hapus import config
- [ ] Hapus `apps/web/lib/wallet/config.ts`
- [ ] Hapus direktori `apps/web/lib/wallet/` jika kosong (pindahkan use-wallet.ts ke `apps/web/lib/` root atau `apps/web/lib/hooks/`)
- [ ] Grep `from "wagmi"` di seluruh `apps/web/{app,components,lib}` — harus 0 hasil
- [ ] Hapus `"wagmi"` dari `apps/web/package.json` deps
- [ ] `npm install` (regenerate lockfile)
- [ ] `npm run typecheck -w @shire/web` — lulus
- [ ] Commit: `refactor(web): remove dead wagmi config, keep demo wallet store`

### A1.3 Hapus agent onchain-sync stub
- [ ] Baca `apps/agent/src/runtime/jobs/job-contracts.ts` — identifikasi varian `onchain-sync` di `jobRequestSchema`
- [ ] Baca `apps/agent/src/runtime/jobs/job-processors.ts` — identifikasi dispatch onchain-sync
- [ ] Hapus `apps/agent/src/runtime/jobs/onchain-sync.processor.ts`
- [ ] Hapus `apps/agent/src/jobs/run-onchain-sync.ts`
- [ ] Hapus varian `onchain-sync` dari `jobRequestSchema` (`job-contracts.ts`)
- [ ] Hapus dispatch onchain-sync dari `job-processors.ts`
- [ ] Hapus script `job:onchain-sync` dari `apps/agent/package.json`
- [ ] Update/hapus test terkait onchain-sync di `apps/agent/test/` jika ada (cek `grep -ri onchain apps/agent/test`)
- [ ] `npm run typecheck -w @shire/agent` — lulus
- [ ] `npm test -w @shire/agent` — lulus
- [ ] Commit: `refactor(agent): remove onchain-sync stub job`

### A1.4 Checkpoint review
- [ ] `npm run typecheck` (root) — lulus
- [ ] `npm run build -w @shire/web` — lulus
- [ ] `npm test -w @shire/agent` — lulus
- [ ] `npm test -w @shire/web` — lulus
- [ ] Jalankan `npm run dev -w @shire/web`, verifikasi UI jalan di demo mode (connect page, dashboard, recruiter pages)
- [ ] **Checkpoint: konfirmasi dengan user sebelum lanjut Fase A2**

---

## Fase A2 — Unifikasi duplikasi data & type

### A2.1 Hapus store/initial-data.ts wrapper
- [ ] Baca `apps/web/store/initial-data.ts` — konfirmasi hanya re-export clone dari `lib/seed.ts`
- [ ] Baca `apps/web/store/index.ts` — identifikasi import dari `./initial-data`
- [ ] Ubah `store/index.ts` import langsung dari `../lib/seed` (jobs, seedApplications, seedStakes, seedDisputes)
- [ ] Hapus `apps/web/store/initial-data.ts`
- [ ] `npm run typecheck -w @shire/web` — lulus
- [ ] Commit: `refactor(web): import store seed directly, remove initial-data wrapper`

### A2.2 Konsolidasi JobStatus & Notification type
- [ ] Baca `apps/web/lib/types.ts` — identifikasi `JobStatus` canonical (line 57) & `Notification` (line 201)
- [ ] Baca `apps/web/lib/dashboard-data.ts` — identifikasi duplikat `JobStatus` (line 63), `Notification` (line 230), `JobRow` (line 65)
- [ ] Hapus deklarasi duplikat `JobStatus`/`Notification` di `dashboard-data.ts`, import dari `lib/types.ts`
- [ ] Adaptasi `JobRow` di dashboard-data agar kompatibel (atau map dari `Job` canonical)
- [ ] Update konsumen `dashboard-data.ts` jika type signature berubah (cek `components/dashboard/*`)
- [ ] `npm run typecheck -w @shire/web` — lulus
- [ ] Commit: `refactor(web): single source for JobStatus and Notification types`

### A2.3 Derive dashboard-data dari seed
- [ ] Baca `apps/web/lib/dashboard-data.ts` `jobCatalog` (line 75-121) — identifikasi overlap dengan `lib/seed.ts` jobs (line 82-222)
- [ ] Derive `jobCatalog` dari `lib/seed.ts` jobs (map field), pertahankan field dashboard-specific (stake display string)
- [ ] Pertahankan KPI/chart series yang unik (activitySeries, matchQuality, pipelineBars) — tidak duplikat, jangan dihapus
- [ ] Hapus `seedNotifications` di `lib/seed.ts:415-419` jika 0 konsumen (grep dulu)
- [ ] `npm run typecheck -w @shire/web` — lulus
- [ ] `npm test -w @shire/web` — lulus
- [ ] Commit: `refactor(web): derive dashboard job catalog from canonical seed`

### A2.4 Hapus lib/store.ts barrel
- [ ] Grep semua import `from "@/lib/store"` di `apps/web/{app,components,lib}`
- [ ] Untuk tiap file (±27), ubah import jadi `from "@/store"`
- [ ] Hapus `apps/web/lib/store.ts`
- [ ] `npm run typecheck -w @shire/web` — lulus
- [ ] Commit: `refactor(web): import store from @/store, remove barrel shim`

### A2.5 Checkpoint review
- [ ] `npm run typecheck` (root) — lulus
- [ ] `npm test -w @shire/web` — lulus
- [ ] Verifikasi tidak ada 2 definisi `JobStatus`/`Notification` (grep konfirmasi)
- [ ] **Checkpoint: konfirmasi user sebelum Fase A3**

---

## Fase A3 — Rapikan stake sebagai domain data simulated

### A3.1 Hapus fake tx hash theatricals
- [ ] Baca `apps/web/store/utils.ts` — identifikasi `randomTx()`, `demoAddress()`
- [ ] Baca `apps/web/store/index.ts` action `stakeForJob` (line 118) — lihat penggunaan `randomTx()`
- [ ] Ganti `randomTx()` dengan ID internal deterministik (mis. `sim_${crypto.randomUUID()}` atau running counter) — tandai jelas "simulated"
- [ ] Update `Stake` type di `lib/types.ts` jika `txHash` field ada — dokumentasikan "simulated, will hold real tx hash onchain phase"
- [ ] Hapus `randomTx()` dari `store/utils.ts` (pertahankan `demoAddress()` bila masih dipakai `connect`)
- [ ] Update `apps/web/components/stake/stake-history-card.tsx` — ganti celoscan link jadi badge "Simulated" (disabled link), bukan `https://alfajores.celoscan.io/tx/...`
- [ ] `npm run typecheck -w @shire/web` — lulus
- [ ] Commit: `refactor(web): mark stake data as simulated, remove fake tx hash`

### A3.2 Dokumentasi stake sebagai simulated
- [ ] Tambah komentar di `apps/web/lib/types.ts` atas `Stake` type: "// Simulated stake data. Will back real onchain escrow in the web3 phase."
- [ ] Tambah komentar di `apps/web/store/index.ts` atas action `stakeForJob`: "// Simulated. Real onchain stake deferred to web3 phase."
- [ ] `npm run typecheck -w @shire/web` — lulus
- [ ] Commit: `docs(web): document stake state as simulated pending web3 phase`

### A3.3 Checkpoint review
- [ ] `npm run typecheck -w @shire/web` — lulus
- [ ] UI stake pages tetap render, label "Simulated" muncul
- [ ] **Checkpoint: konfirmasi user sebelum Fase A4**

---

## Fase A4 — Unifikasi recruiter/candidate profile write path

### A4.1 Tambah upsertProfileWithMetrics ke repository
- [ ] Baca `apps/web/lib/server/profile-repository.ts` fully — pahami `ProfileRepository` interface, `buildRoleProfileUpsertQuery`, `saveProfileForPrivyUser`
- [ ] Baca `apps/web/lib/server/profile-route.ts` `saveRecruiterProfileAtomically` (line 60-112) & branch PUT (line 184-209) — identifikasi logic metrics-merge yang harus dipindah
- [ ] Tulis test gagal dulu di `apps/web/test/profile-repository.test.ts`: `upsertProfileWithMetrics` untuk role recruiter mempertahankan immutable metrics (verificationStatus, trustLevel, completedHires, disputeCount) dan merge dengan payload editable
- [ ] Run test — konfirmasi gagal (method belum ada)
- [ ] Implement `upsertProfileWithMetrics(userId, role, profile, metricsKeys)` di `ProfileRepository` interface + impl (Postgres + InMemory)
- [ ] Run test — lulus
- [ ] Commit: `feat(web): add upsertProfileWithMetrics to profile repository`

### A4.2 Hapus fork paralel di profile-route
- [ ] Refactor PUT handler `profile-route.ts:184-209` — panggil `repository.upsertProfileWithMetrics` untuk recruiter (dan `upsertProfile` untuk candidate), hapus branch inline
- [ ] Hapus `saveRecruiterProfileAtomically` (line 60-112) — logic sudah di repository
- [ ] Update test `apps/web/test/profile-route.test.ts` — pastikan recruiter PUT masih preserve metrics, candidate PUT tidak
- [ ] Run `npm test -w @shire/web` — lulus
- [ ] Commit: `refactor(web): unify recruiter/candidate profile write path via repository`

### A4.3 Checkpoint review
- [ ] `npm run typecheck -w @shire/web` — lulus
- [ ] `npm test -w @shire/web` — lulus (semua profile test)
- [ ] **Checkpoint: konfirmasi user sebelum Fase A5**

---

## Fase A5 — Struktur & dokumentasi

### A5.1 .env.example lengkap
- [ ] Cek apakah `apps/web/.env.example` ada; baca isinya
- [ ] Buat/update root `.env.example` dengan semua env yang dirujuk kode:
  - `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_PRIVY_APP_ID`, `PRIVY_APP_SECRET`
  - `DATABASE_URL`, `DIRECT_DATABASE_URL`
  - `SHIRE_AGENT_CHAT_URL`, `SHIRE_AGENT_INTERNAL_URL`, `SHIRE_AGENT_SERVICE_TOKEN`
- [ ] Tambah komentar penanda mana yang WAJIB production vs opsional
- [ ] Commit: `docs: complete root .env.example`

### A5.2 Samakan vercel.json
- [ ] Baca root `vercel.json` dan `apps/web/vercel.json`
- [ ] Putuskan: keep root (turbo filter) ATAU apps/web. Hapus yang lain.
- [ ] Rekomendasi: keep root `vercel.json` dengan `turbo run build --filter=@shire/web`, hapus `apps/web/vercel.json`
- [ ] Commit: `chore(web): consolidate vercel.json to root`

### A5.3 Update spec & decision log
- [ ] Update `architecture.md` §3.1: ORM = Drizzle (bukan Prisma)
- [ ] Update `architecture.md` §9/§12: entity = recruiter profile (bukan Company/CompanyMember), note "Web2-first phase; onchain/staking deferred"
- [ ] Update `tasks.md`: tandai Fase A1-A5 `[x]`, Fase B `[ ]` sebagai next
- [ ] Isi `.agent/decisions/log.md`:
  ```
  ## 2026-06-19
  - Problem: Codebase punya dead code web3, duplikasi data/type, fork profile path, spec drift
  - Decision: Web2-first pivot. Pertahankan Privy + Drizzle + recruiter model. Hapus web3 plumbing, unifikasi, defer onchain.
  - Rationale: Sistem web2 harus jalan dulu sebelum integrasi web3.
  - Impact: Fase A cleanup, Fase B web2 foundation. Onchain/staking siklus berikutnya.
  ```
- [ ] Commit: `docs: align architecture/tasks with web2-first drizzle recruiter model`

### A5.4 Final review Fase A
- [ ] `npm run typecheck` (root) — lulus
- [ ] `npm run build -w @shire/web` — lulus
- [ ] `npm run build -w @shire/agent` — lulus
- [ ] `npm test -w @shire/agent` — lulus
- [ ] `npm test -w @shire/web` — lulus
- [ ] `npm run dev` (root) — kedua app jalan, UI demo mode normal
- [ ] **Final checkpoint: Fase A selesai. Konfirmasi user sebelum mulai Fase B (web2 foundation).**

---

## Out of scope (siklus onchain berikutnya)
- `ShireEscrow.sol` implementasi
- wagmi provider mount + staking tx nyata
- onchain event sync listener
- dispute/evidence flow
- 3 domain agent sisanya + matching pipeline
- scheduler (node-cron/BullMQ recurring)
