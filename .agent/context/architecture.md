# SHIRE — Final Architecture

## Fullstack Next.js Monorepo + Mastra + Privy SIWE + MiniPay + Prisma + PostgreSQL + Stellar Staking

This document is the latest final architecture for the **Shire** project, based on the updated concept that a wallet-based user can be a job seeker, a talent seeker, or both at the same time.

---

## Table of Contents

1. [Core Product Goal](#1-core-product-goal)
2. [System Principles](#2-system-principles)
3. [Final Tech Stack](#3-final-tech-stack)
4. [High-Level Architecture](#4-high-level-architecture)
5. [Identity Model](#5-identity-model)
6. [Auth Flow](#6-auth-flow)
7. [User Mode dan Onboarding](#7-user-mode-dan-onboarding)
8. [Monorepo Structure](#8-monorepo-structure)
9. [Package Responsibility](#9-package-responsibility)
10. [Root Config](#10-root-config)
11. [Environment Variables](#11-environment-variables)
12. [Database Design](#12-database-design)
13. [Permission Model](#13-permission-model)
14. [Access Rules](#14-access-rules)
15. [Product Routes](#15-product-routes)
16. [API Routes](#16-api-routes)
17. [Agent Orchestration Design](#17-agent-orchestration-design)
18. [AI Context Design](#18-ai-context-design)
19. [Agent Workflows](#19-agent-workflows)
20. [Matching Pipeline](#20-matching-pipeline)
21. [Zod Schemas](#21-zod-schemas)
22. [Smart Contract Design](#22-smart-contract-design)
23. [Staking Flow](#23-staking-flow)
24. [Onchain Sync](#24-onchain-sync)
25. [Frontend UX](#25-frontend-ux)
26. [Scheduler](#26-scheduler)
27. [Security Rules](#27-security-rules)
28. [Development Execution Plan for Codex](#28-development-execution-plan-for-codex)
29. [MVP Scope](#29-mvp-scope)
30. [Final Codex Instruction](#30-final-codex-instruction)

---

# 1. Core Product Goal

Shire is an AI-powered hiring marketplace with stablecoin staking on Stellar (Soroban).

Core narrative:

```txt
AI finds jobs and talents.
Users approve important actions.
Stablecoin escrow on Stellar protects both parties.
Smart contract locks and settles funds.
```

Shire has two usage modes:

```txt
1. Find Jobs
   For users who want to find work.

2. Find Talents
   For users, companies, or agencies who want to find talent.

3. Use Both
   For users who want to do both.
```

One wallet can:

```txt
- Upload CV
- Create a candidate profile
- Search for jobs
- Apply ke job
- Create a company or agency profile
- Create a job post
- Search for talent
- Invite candidates
- Stake as an applicant
- Stake as a company
```

---

# 2. System Principles

## 2.1 Core principle

```txt
AI finds.
User approves.
Contract locks.
Workflow tracks.
Resolver decides.
Contract settles.
```

## 2.2 AI constraints

AI may:

```txt
- Read CVs
- Create profile drafts
- Analyze job posts
- Find matching jobs
- Find matching talent
- Provide match scores
- Provide recommendation reasons
- Create dispute summaries
```

AI must not:

```txt
- Log in as the user
- Stake automatically
- Apply automatically without user approval
- Invite talent automatically without company approval
- Sign wallet transactions
- Slash stake
- Resolve disputes
- Make final hiring decisions
```

---

# 3. Final Tech Stack

## 3.1 App Stack

```txt
Framework:
Next.js App Router

Language:
TypeScript

UI:
TailwindCSS
shadcn/ui

Auth:
Privy
SIWE / wallet authentication

Mini App:
MiniPay compatible wallet flow

Agent:
Mastra

Database:
PostgreSQL

ORM:
Prisma

Vector / Matching:
pgvector optional
Skill overlap + rule-based matching for MVP

Blockchain:
Stellar
Soroban (Rust)
@stellar/stellar-sdk
Stellar Wallets Kit

Storage:
Cloudflare R2 / S3

Queue / Scheduler:
node-cron for MVP
BullMQ + Redis for production
```

## 3.2 Why this stack

```txt
Next.js:
For the frontend, backend API, server actions, and dashboard.

Mastra:
For agent orchestration, AI workflows, and the autonomous matching loop.

Prisma:
For a clear ORM and database schema.

PostgreSQL:
For the offchain source of truth.

Stellar:
For onchain staking escrow, via Soroban smart contracts.

Privy:
For wallet login and SIWE in the web app.

MiniPay:
For the Mini App experience with a Celo wallet.
```

---

# 4. Arsitektur High-Level

```txt
┌────────────────────────────────────┐
│             User                    │
│ Web Browser / MiniPay Mini App      │
└─────────────────┬──────────────────┘
                  │
                  v
┌────────────────────────────────────┐
│           Next.js App               │
│ UI + API Routes + Server Actions    │
└───────────────┬────────────┬───────┘
                │            │
                │            │
                v            v
┌──────────────────────┐  ┌──────────────────────┐
│ Privy Auth / SIWE     │  │ Stellar Wallet        │
│ User Session          │  │ Stellar Wallets Kit   │
└──────────────────────┘  └──────────────────────┘
                │
                v
┌────────────────────────────────────┐
│           PostgreSQL                │
│ Prisma ORM                          │
└─────────────────┬──────────────────┘
                  │
                  v
┌────────────────────────────────────┐
│          Mastra Agent Service       │
│ CV Agent / Matching / Dispute       │
└─────────────────┬──────────────────┘
                  │
                  v
┌────────────────────────────────────┐
│        Soroban Smart Contract       │
│ ShireEscrow (Stellar)               │
└────────────────────────────────────┘
```

---

# 5. Identity Model

## 5.1 Do not use permanent roles

Do not design the user like this:

```txt
User.role = CANDIDATE
atau
User.role = COMPANY
```

Because this limits the user.

## 5.2 Use wallet identity + multi-mode

The correct design is:

```txt
User = the primary wallet-based identity
CandidateProfile = optional
Company/Agency = optional dan bisa lebih dari satu
ActiveMode = the current UI mode in use
```

Contoh:

```txt
User wallet: 0xABC...

User punya:
├── Candidate Profile
├── Company: Shire Labs
└── Agency: TalentHub Indonesia
```

That means the same user can:

```txt
- Search for work as a candidate
- Search for talent as a company
- Switch modes at any time
```

---

# 6. Auth Flow

## 6.1 Web App Auth Flow with Privy

Flow:

```txt
User opens Shire web
   ↓
Click Login
   ↓
Privy wallet login / SIWE
   ↓
Backend reads the Privy session
   ↓
Find or create User by privyUserId / walletAddress
   ↓
If onboarding is incomplete → redirect to `/onboarding`
   ↓
If onboarding is complete → redirect to `/dashboard`
```

## 6.2 MiniPay Mini App Auth Flow

Flow:

```txt
User opens Shire in MiniPay
   ↓
App detects the MiniPay environment
   ↓
Wallet provider tersedia
   ↓
Connect the wallet via wagmi
   ↓
Create or verify app session
   ↓
Find or create User by walletAddress
   ↓
If onboarding is incomplete → redirect to `/onboarding`
   ↓
If onboarding is complete → redirect to `/dashboard`
```

## 6.3 Auth source priority

Saat user login, sistem harus mapping identity seperti ini:

```txt
Primary identity:
privyUserId, jika tersedia

Secondary identity:
walletAddress

Optional:
email
```

Rule:

```txt
If `privyUserId` exists, use `privyUserId` as the primary identity.
If the flow is wallet-only in MiniPay, use `walletAddress` as the primary identity.
If the user later logs in through Privy with the same wallet, merge by `walletAddress`.
```

---

# 7. User Mode and Onboarding

## 7.1 Mode

```txt
Candidate Mode:
For finding work.

Company Mode:
For finding talent.

Both:
The user can switch between both.
```

## 7.2 Onboarding Page

Route:

```txt
/onboarding
```

Content:

```txt
Welcome to Shire.
What do you want to do today?

[ Find Jobs ]
AI helps you turn your CV into a profile and find matching jobs.

[ Find Talents ]
AI helps your company or agency find matching candidates.

[ Use Both ]
Switch between job seeker and recruiter mode anytime.
```

## 7.3 Onboarding Behavior

### If the user chooses Find Jobs

```txt
1. Set activeMode = CANDIDATE
2. Create an empty `CandidateProfile` draft if one does not exist
3. Redirect to `/candidate/profile`
```

### If the user chooses Find Talents

```txt
1. Set activeMode = COMPANY
2. Redirect to `/company/new`
```

### If the user chooses Use Both

```txt
1. Set activeMode = BOTH
2. Create an empty `CandidateProfile` draft if the user wants one
3. Redirect to `/dashboard`
```

## 7.4 Mode Switcher

The navbar should include a mode switcher:

```txt
[ Candidate Mode ] [ Company Mode ]
```

Switching mode only changes UI context, not permanent permissions.

---

# 8. Monorepo Structure

Use:

```txt
pnpm workspace
Turborepo
Next.js
Mastra
Prisma
```

Struktur final:

```txt
shire/
├─ apps/
│  ├─ web/
│  │  ├─ app/
│  │  │  ├─ (public)/
│  │  │  │  ├─ page.tsx
│  │  │  │  └─ layout.tsx
│  │  │  ├─ onboarding/
│  │  │  │  └─ page.tsx
│  │  │  ├─ dashboard/
│  │  │  │  └─ page.tsx
│  │  │  ├─ candidate/
│  │  │  │  ├─ dashboard/
│  │  │  │  ├─ profile/
│  │  │  │  ├─ recommendations/
│  │  │  │  └─ applications/
│  │  │  ├─ company/
│  │  │  │  ├─ dashboard/
│  │  │  │  ├─ new/
│  │  │  │  ├─ switch/
│  │  │  │  ├─ jobs/
│  │  │  │  ├─ talents/
│  │  │  │  └─ applications/
│  │  │  ├─ admin/
│  │  │  │  ├─ dashboard/
│  │  │  │  ├─ disputes/
│  │  │  │  ├─ applications/
│  │  │  │  └─ companies/
│  │  │  ├─ api/
│  │  │  │  ├─ auth/
│  │  │  │  ├─ onboarding/
│  │  │  │  ├─ candidate/
│  │  │  │  ├─ company/
│  │  │  │  ├─ jobs/
│  │  │  │  ├─ applications/
│  │  │  │  ├─ recommendations/
│  │  │  │  ├─ upload/
│  │  │  │  ├─ agent/
│  │  │  │  └─ onchain/
│  │  │  ├─ layout.tsx
│  │  │  └─ globals.css
│  │  ├─ components/
│  │  │  ├─ auth/
│  │  │  ├─ layout/
│  │  │  ├─ wallet/
│  │  │  ├─ candidate/
│  │  │  ├─ company/
│  │  │  └─ application/
│  │  ├─ features/
│  │  │  ├─ auth/
│  │  │  ├─ onboarding/
│  │  │  ├─ candidate/
│  │  │  ├─ company/
│  │  │  ├─ jobs/
│  │  │  ├─ recommendations/
│  │  │  ├─ applications/
│  │  │  └─ onchain/
│  │  ├─ lib/
│  │  │  ├─ auth.ts
│  │  │  ├─ privy.ts
│  │  │  ├─ minipay.ts
│  │  │  ├─ permissions.ts
│  │  │  ├─ server-user.ts
│  │  │  └─ utils.ts
│  │  ├─ hooks/
│  │  ├─ middleware.ts
│  │  ├─ next.config.ts
│  │  └─ package.json
│  │
│  └─ agent/
│     ├─ src/
│     │  ├─ mastra/
│     │  │  ├─ agents/
│     │  │  │  ├─ cv-profile.agent.ts
│     │  │  │  ├─ job-matching.agent.ts
│     │  │  │  ├─ talent-matching.agent.ts
│     │  │  │  └─ dispute-summary.agent.ts
│     │  │  ├─ workflows/
│     │  │  │  ├─ parse-cv.workflow.ts
│     │  │  │  ├─ job-matching.workflow.ts
│     │  │  │  ├─ talent-matching.workflow.ts
│     │  │  │  └─ dispute-summary.workflow.ts
│     │  │  ├─ tools/
│     │  │  │  ├─ user.tools.ts
│     │  │  │  ├─ candidate.tools.ts
│     │  │  │  ├─ company.tools.ts
│     │  │  │  ├─ job.tools.ts
│     │  │  │  ├─ matching.tools.ts
│     │  │  │  └─ evidence.tools.ts
│     │  │  └─ index.ts
│     │  ├─ jobs/
│     │  │  ├─ run-cv-parse.ts
│     │  │  ├─ run-job-matching.ts
│     │  │  ├─ run-talent-matching.ts
│     │  │  ├─ run-onchain-sync.ts
│     │  │  └─ run-dispute-summary.ts
│     │  ├─ server.ts
│     │  └─ env.ts
│     └─ package.json
│
├─ packages/
│  ├─ db/
│  │  ├─ prisma/
│  │  │  ├─ schema.prisma
│  │  │  └─ migrations/
│  │  ├─ src/
│  │  │  ├─ client.ts
│  │  │  ├─ queries/
│  │  │  └─ index.ts
│  │  └─ package.json
│  │
│  ├─ shared/
│  │  ├─ src/
│  │  │  ├─ schemas/
│  │  │  ├─ types/
│  │  │  ├─ constants/
│  │  │  ├─ enums.ts
│  │  │  └─ index.ts
│  │  └─ package.json
│  │
│  ├─ ai-context/
│  │  ├─ src/
│  │  │  ├─ system-context.ts
│  │  │  ├─ cv-profile-context.ts
│  │  │  ├─ job-matching-context.ts
│  │  │  ├─ talent-matching-context.ts
│  │  │  ├─ dispute-context.ts
│  │  │  └─ index.ts
│  │  └─ package.json
│  │
│  ├─ contracts/
│  │  ├─ src/
│  │  │  ├─ spec/
│  │  │  ├─ addresses.ts
│  │  │  ├─ stellar.ts
│  │  │  ├─ escrow.ts
│  │  │  └─ index.ts
│  │  └─ package.json
│  │
│  └─ ui/
│     ├─ src/
│     └─ package.json
│
├─ contracts/
│  ├─ src/
│  │  └─ ShireEscrow.sol
│  ├─ script/
│  ├─ test/
│  ├─ foundry.toml
│  └─ package.json
│
├─ package.json
├─ pnpm-workspace.yaml
├─ turbo.json
├─ tsconfig.base.json
├─ .env.example
└─ README.md
```

---

# 9. Package Responsibility

## 9.1 `apps/web`

Next.js fullstack app.

Tanggung jawab:

```txt
- Public landing page
- Log in with Privy
- MiniPay wallet detection
- User onboarding
- Candidate dashboard
- Company dashboard
- Admin dashboard
- API routes
- Server actions
- Upload CV
- Profile review
- Recommendation UI
- Application workflow
- Wallet transaction UI
- Onchain status display
```

## 9.2 `apps/agent`

Mastra agent service.

Tanggung jawab:

```txt
- CV Profile Agent
- Job Matching Agent
- Talent Matching Agent
- Dispute Summary Agent
- Scheduled matching loop
- Agent run logging
```

Important rule:

```txt
Agent tidak boleh sign wallet transaction.
Agent tidak boleh melakukan staking.
Agent tidak boleh resolve dispute.
```

## 9.3 `packages/db`

Database package.

Tanggung jawab:

```txt
- Prisma schema
- Prisma client singleton
- Shared database queries
- Database migrations
```

Semua app harus import database dari:

```ts
import { db } from "@shire/db";
```

## 9.4 `packages/shared`

Shared package.

Tanggung jawab:

```txt
- Zod schema
- TypeScript type
- Shared enum
- Constants
- Validation helpers
```

## 9.5 `packages/ai-context`

AI context package.

Tanggung jawab:

```txt
- Global system prompt
- Agent-specific prompt
- Platform policy
- Prompt injection guardrail
- Structured output instruction
```

## 9.6 `packages/contracts`

Frontend/backend contract helper.

Tanggung jawab:

```txt
- Contract spec / bindings
- Contract IDs
- @stellar/stellar-sdk helpers
- Soroban network config
- Read contract state
- Prepare transaction (XDR) args
```

## 9.7 `contracts`

Soroban (Rust) workspace.

Tanggung jawab:

```txt
- ShireEscrow (Soroban/Rust)
- Contract tests
- Deploy scripts
- Contract spec generation
```

---

# 10. Root Config

## 10.1 `pnpm-workspace.yaml`

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "contracts"
```

## 10.2 Root `package.json`

```json
{
  "name": "shire",
  "private": true,
  "packageManager": "pnpm@9.0.0",
  "scripts": {
    "dev": "turbo dev",
    "dev:web": "pnpm --filter @shire/web dev",
    "dev:agent": "pnpm --filter @shire/agent dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "db:generate": "pnpm --filter @shire/db db:generate",
    "db:migrate": "pnpm --filter @shire/db db:migrate",
    "db:studio": "pnpm --filter @shire/db db:studio",
    "contracts:test": "pnpm --filter @shire/contracts-sol test",
    "contracts:build": "pnpm --filter @shire/contracts-sol build"
  },
  "devDependencies": {
    "turbo": "latest",
    "typescript": "latest"
  }
}
```

## 10.3 `turbo.json`

```json
{
  "tasks": {
    "dev": {
      "cache": false,
      "persistent": true
    },
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "typecheck": {
      "dependsOn": ["^typecheck"]
    }
  }
}
```

---

# 11. Environment Variables

## 11.1 `.env.example`

```env
# App
NEXT_PUBLIC_APP_NAME="Shire"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/shire"

# Privy
NEXT_PUBLIC_PRIVY_APP_ID=""
PRIVY_APP_SECRET=""

# Auth
AUTH_SECRET="replace_me"

# AI
OPENAI_API_KEY=""
ANTHROPIC_API_KEY=""

# Storage
S3_ENDPOINT=""
S3_REGION=""
S3_ACCESS_KEY_ID=""
S3_SECRET_ACCESS_KEY=""
S3_BUCKET="shire"

# Agent
AGENT_SERVICE_URL="http://localhost:4111"
AGENT_INTERNAL_SECRET="replace_me"

# Stellar
NEXT_PUBLIC_STELLAR_NETWORK="testnet"
NEXT_PUBLIC_SHIRE_ESCROW_CONTRACT_ID=""
STELLAR_RPC_URL="https://soroban-testnet.stellar.org"

# Admin
DISPUTE_RESOLVER_ADDRESS=""
```

---

# 12. Database Design

## 12.1 Schema concept

Important changes:

```txt
The user does not have a permanent `CANDIDATE`/`COMPANY` role.
The user only has `userType` of `USER`/`ADMIN`.
`CandidateProfile` is optional.
A user can own many companies.
The user-to-company relation goes through `CompanyMember`.
```

## 12.2 Prisma schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserType {
  USER
  ADMIN
}

enum UserMode {
  CANDIDATE
  COMPANY
  BOTH
}

enum ProfileStatus {
  DRAFT
  PENDING_REVIEW
  CONFIRMED
  NEEDS_UPDATE
  SUSPENDED
}

enum CompanyStatus {
  DRAFT
  ACTIVE
  SUSPENDED
  VERIFIED
}

enum CompanyMemberRole {
  OWNER
  ADMIN
  RECRUITER
}

enum JobStatus {
  DRAFT
  ACTIVE
  PAUSED
  CLOSED
  SUSPENDED
}

enum RecommendationType {
  JOB_TO_CANDIDATE
  TALENT_TO_COMPANY
}

enum RecommendationStatus {
  NEW
  SEEN
  ACCEPTED
  REJECTED
  EXPIRED
}

enum ApplicationStatus {
  CREATED
  APPLICANT_STAKED
  COMPANY_STAKED
  IN_REVIEW
  INTERVIEW
  OFFERED
  HIRED
  REJECTED
  COMPLETED
  CANCELLED
  EXPIRED
  DISPUTED
  RESOLVED
}

enum DisputeStatus {
  OPEN
  UNDER_REVIEW
  RESOLVED
  REJECTED
}

enum AgentRunStatus {
  SUCCESS
  FAILED
  PARTIAL
}

model User {
  id             String   @id @default(cuid())
  privyUserId    String?  @unique
  walletAddress  String?  @unique
  email          String?  @unique

  userType       UserType @default(USER)
  activeMode     UserMode?
  onboardingDone Boolean  @default(false)

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  candidateProfile CandidateProfile?
  companyMemberships CompanyMember[]

  applicationsAsCandidate Application[] @relation("CandidateApplications")
  disputesOpened          Dispute[]     @relation("DisputesOpened")
}

model CandidateProfile {
  id                String        @id @default(cuid())
  userId            String        @unique

  fullName          String?
  headline          String?
  summary           String?
  skills            Json
  workExperience    Json?
  education         Json?
  preferredRoles    Json?
  expectedSalary    Json?
  location          String?
  workPreference    String?
  portfolioUrl      String?
  githubUrl         String?
  linkedinUrl       String?

  profileStatus     ProfileStatus @default(DRAFT)
  profileConfidence Float?

  embeddingText     String?
  embedding         Unsupported("vector")?

  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt

  user User @relation(fields: [userId], references: [id])
  recommendations Recommendation[] @relation("CandidateRecommendations")
}

model Company {
  id                 String        @id @default(cuid())

  companyName         String
  website             String?
  description         String?
  industry            String?
  companySize         String?
  verificationStatus  CompanyStatus @default(DRAFT)
  riskScore           Float?

  createdAt           DateTime      @default(now())
  updatedAt           DateTime      @updatedAt

  members             CompanyMember[]
  jobs                Job[]
  applications        Application[]
  recommendations     Recommendation[] @relation("CompanyRecommendations")
}

model CompanyMember {
  id        String            @id @default(cuid())
  userId    String
  companyId String
  role      CompanyMemberRole @default(OWNER)

  createdAt DateTime          @default(now())

  user    User    @relation(fields: [userId], references: [id])
  company Company @relation(fields: [companyId], references: [id])

  @@unique([userId, companyId])
}

model Job {
  id                   String    @id @default(cuid())
  companyId             String

  title                 String
  description           String
  requiredSkills         Json
  niceToHaveSkills       Json?
  salaryRange            Json?
  workType               String?
  location               String?
  experienceMin          Int?
  experienceMax          Int?

  applicantStakeAmount   Decimal
  companyStakeAmount     Decimal

  status                 JobStatus @default(DRAFT)

  embeddingText          String?
  embedding              Unsupported("vector")?

  createdAt              DateTime  @default(now())
  updatedAt              DateTime  @updatedAt

  company        Company @relation(fields: [companyId], references: [id])
  applications   Application[]
  recommendations Recommendation[]
}

model Recommendation {
  id                  String               @id @default(cuid())

  type                RecommendationType

  candidateProfileId  String?
  companyId           String?
  jobId               String?

  matchScore          Float
  confidence          Float?
  reasons             Json
  missingRequirements Json?
  riskFlags           Json?

  status              RecommendationStatus @default(NEW)

  createdAt           DateTime             @default(now())
  updatedAt           DateTime             @updatedAt

  candidateProfile CandidateProfile? @relation("CandidateRecommendations", fields: [candidateProfileId], references: [id])
  company          Company?          @relation("CompanyRecommendations", fields: [companyId], references: [id])
  job              Job?              @relation(fields: [jobId], references: [id])
}

model Application {
  id                    String            @id @default(cuid())

  onchainApplicationId   BigInt?

  jobId                 String
  candidateUserId        String
  companyId             String

  status                ApplicationStatus @default(CREATED)

  applicantStakeTx       String?
  companyStakeTx         String?

  deadline              DateTime?

  createdAt             DateTime          @default(now())
  updatedAt             DateTime          @updatedAt

  job       Job     @relation(fields: [jobId], references: [id])
  candidate User    @relation("CandidateApplications", fields: [candidateUserId], references: [id])
  company   Company @relation(fields: [companyId], references: [id])

  disputes  Dispute[]
}

model Dispute {
  id             String        @id @default(cuid())

  applicationId  String
  openedByUserId String

  reason         String
  status         DisputeStatus @default(OPEN)

  summary        Json?
  resolution     Json?
  resolverUserId String?

  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt

  application Application @relation(fields: [applicationId], references: [id])
  openedBy    User        @relation("DisputesOpened", fields: [openedByUserId], references: [id])
  evidences   Evidence[]
}

model Evidence {
  id            String   @id @default(cuid())

  disputeId     String
  submittedBy   String
  evidenceType  String
  evidenceUri   String
  evidenceHash  String

  createdAt     DateTime @default(now())

  dispute Dispute @relation(fields: [disputeId], references: [id])
}

model AgentRun {
  id           String         @id @default(cuid())

  agentName    String
  workflowName String?

  input        Json?
  output       Json?

  status       AgentRunStatus
  errorMessage String?
  tokenUsage   Json?
  latencyMs    Int?

  createdAt    DateTime       @default(now())
}

model OnchainEvent {
  id          String   @id @default(cuid())

  txHash      String
  eventName   String
  blockNumber BigInt
  payload     Json
  processed   Boolean  @default(false)

  createdAt   DateTime @default(now())

  @@unique([txHash, eventName])
}
```

---

# 13. Permission Model

Shire memakai 3 level permission.

## 13.1 Account permission

```txt
UserType.USER
UserType.ADMIN
```

Untuk akses umum dan admin.

## 13.2 Company permission

```txt
CompanyMemberRole.OWNER
CompanyMemberRole.ADMIN
CompanyMemberRole.RECRUITER
```

For managing companies, job posts, and talent workflows.

## 13.3 Application role

Role based on a specific application:

```txt
APPLICANT
COMPANY
```

A single user can be a candidate in application A and a company owner in application B.

---

# 14. Access Rules

## 14.1 Candidate route

The user may access `/candidate/*` if:

```txt
- They are logged in
- They have a `User` record
- They have a `CandidateProfile` or are willing to create one
```

## 14.2 Company route

The user may access `/company/*` if:

```txt
- They are logged in
- They have a `CompanyMember` record
  or
- They are creating a new company
```

## 14.3 Admin route

The user may access `/admin/*` if:

```txt
User.userType = ADMIN
```

## 14.4 Anti self-apply rule

The user must not apply to jobs from a company they manage.

Rule:

```ts
const isCompanyMember = job.company.members.some(
  (member) => member.userId === currentUser.id
);

if (isCompanyMember) {
  throw new Error("You cannot apply to your own company job.");
}
```

---

# 15. Product Routes

## 15.1 Public routes

```txt
/
 /about
 /how-it-works
 /for-candidates
 /for-companies
```

## 15.2 Auth routes

```txt
/onboarding
/dashboard
```

## 15.3 Candidate routes

```txt
/candidate/dashboard
/candidate/profile
/candidate/profile/review
/candidate/recommendations
/candidate/applications
/candidate/applications/[id]
```

## 15.4 Company routes

```txt
/company/dashboard
/company/new
/company/switch
/company/profile/[companyId]
/company/jobs
/company/jobs/new
/company/jobs/[id]
/company/jobs/[id]/talents
/company/applications
/company/applications/[id]
```

## 15.5 Admin routes

```txt
/admin/dashboard
/admin/disputes
/admin/disputes/[id]
/admin/applications
/admin/companies
```

---

# 16. API Routes

## 16.1 Auth API

```txt
GET  /api/auth/me
POST /api/auth/sync-user
POST /api/auth/set-active-mode
```

### `/api/auth/sync-user`

Tugas:

```txt
- Read the Privy session or wallet session
- Find or create the User
- Link privyUserId, walletAddress, email jika tersedia
- Return current user
```

## 16.2 Onboarding API

```txt
POST /api/onboarding/select-mode
```

Body:

```json
{
  "mode": "CANDIDATE"
}
```

Behavior:

```txt
CANDIDATE:
- Set activeMode CANDIDATE
- Create CandidateProfile draft if not exists
- onboardingDone = true

COMPANY:
- Set activeMode COMPANY
- onboardingDone = true

BOTH:
- Set activeMode BOTH
- onboardingDone = true
```

## 16.3 Candidate API

```txt
POST /api/candidate/cv/upload
GET  /api/candidate/profile
PATCH /api/candidate/profile
POST /api/candidate/profile/confirm
GET  /api/candidate/recommendations
POST /api/candidate/recommendations/:id/reject
POST /api/candidate/apply/:jobId
```

## 16.4 Company API

```txt
POST /api/company
GET  /api/company
GET  /api/company/:companyId
PATCH /api/company/:companyId
POST /api/company/:companyId/members
POST /api/company/:companyId/jobs
GET  /api/company/:companyId/jobs
PATCH /api/company/:companyId/jobs/:jobId
POST /api/company/:companyId/jobs/:jobId/activate
GET  /api/company/:companyId/jobs/:jobId/talent-recommendations
POST /api/company/:companyId/invite/:candidateId
```

## 16.5 Application API

```txt
GET  /api/applications/:id
POST /api/applications/:id/company-accept
POST /api/applications/:id/mark-completed
POST /api/applications/:id/confirm-completed
POST /api/applications/:id/open-dispute
POST /api/applications/:id/submit-evidence
POST /api/applications/:id/refund-expired
```

## 16.6 Agent API
Rincian endpoint dan security dipindah ke [`agent/api.md`](./agent/api.md).

## 16.7 Onchain API

```txt
GET  /api/onchain/application/:id
POST /api/onchain/sync
GET  /api/onchain/events
```

---

# 17. Agent Orchestration Design
Rincian penentuan agent dan entity-based activation dipindah ke [`agent/orchestration.md`](./agent/orchestration.md).

# 18. AI Context Design
Rincian system prompt dan agent-specific prompt dipindah ke [`agent/runtime-context.md`](./agent/runtime-context.md).

# 19. Agent Workflows
Rincian workflow operasional dipindah ke [`agent/workflows.md`](./agent/workflows.md).

# 20. Matching Pipeline
Rincian pipeline filtering, scoring, dan threshold dipindah ke [`agent/matching-pipeline.md`](./agent/matching-pipeline.md).

---

# 21. Zod Schemas

Simpan di:

```txt
packages/shared/src/schemas
```

## 21.1 Candidate profile draft schema

```ts
import { z } from "zod";

export const CandidateProfileDraftSchema = z.object({
  fullName: z.string().optional(),
  headline: z.string().optional(),
  summary: z.string().optional(),
  skills: z.array(z.string()).default([]),
  workExperience: z.array(z.object({
    company: z.string().optional(),
    role: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    description: z.string().optional(),
  })).default([]),
  education: z.array(z.object({
    institution: z.string().optional(),
    degree: z.string().optional(),
    year: z.string().optional(),
  })).default([]),
  preferredRoles: z.array(z.string()).default([]),
  expectedSalary: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    currency: z.string().optional(),
  }).optional(),
  location: z.string().optional(),
  workPreference: z.string().optional(),
  portfolioUrl: z.string().url().optional(),
  githubUrl: z.string().url().optional(),
  linkedinUrl: z.string().url().optional(),
  profileConfidence: z.number().min(0).max(1),
  missingFields: z.array(z.string()).default([]),
});
```

## 21.2 Matching output schema

```ts
import { z } from "zod";

export const MatchingOutputSchema = z.object({
  matchScore: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  reasons: z.array(z.string()),
  missingRequirements: z.array(z.string()).default([]),
  riskFlags: z.array(z.string()).default([]),
  recommendedAction: z.enum([
    "SUGGEST_APPLY",
    "SUGGEST_INVITE",
    "SAVE_ONLY",
    "IGNORE"
  ]),
});
```

## 21.3 Onboarding schema

```ts
import { z } from "zod";

export const SelectUserModeSchema = z.object({
  mode: z.enum(["CANDIDATE", "COMPANY", "BOTH"]),
});
```

## 21.4 Company schema

```ts
import { z } from "zod";

export const CompanyCreateSchema = z.object({
  companyName: z.string().min(2),
  website: z.string().url().optional(),
  description: z.string().optional(),
  industry: z.string().optional(),
  companySize: z.string().optional(),
});
```

## 21.5 Job schema

```ts
import { z } from "zod";

export const JobCreateSchema = z.object({
  companyId: z.string(),
  title: z.string().min(2),
  description: z.string().min(20),
  requiredSkills: z.array(z.string()).min(1),
  niceToHaveSkills: z.array(z.string()).optional(),
  salaryRange: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    currency: z.string().optional(),
  }).optional(),
  workType: z.string().optional(),
  location: z.string().optional(),
  experienceMin: z.number().optional(),
  experienceMax: z.number().optional(),
  applicantStakeAmount: z.number().positive(),
  companyStakeAmount: z.number().positive(),
});
```

---

# 22. Smart Contract Design

## 22.1 Contract name

```txt
ShireEscrow (Soroban, Rust/WASM)
```

## 22.2 Important principle

Smart contract tidak tahu apakah user adalah candidate atau company secara permanen.

Smart contract hanya tahu role di application tertentu:

```txt
applicant
company
```

## 22.3 Onchain Application storage

```rust
#[contracttype]
pub struct Application {
    pub id: u64,
    pub job_id: u64,
    pub applicant: Address,
    pub company: Address,
    pub applicant_stake: i128,
    pub company_stake: i128,
    pub status: ApplicationStatus,
    pub created_at: u64,
    pub deadline: u64,
    pub dispute_opened: bool,
}

#[contracttype]
pub enum DataKey {
    Application(u64),
}
```

Type mapping from the earlier Solidity draft: `uint256` amounts → `i128` (matches
`TokenClient`), `address` → `Address`, timestamps → `u64` via `env.ledger().timestamp()`,
`mapping(uint256 => Application)` → storage keyed by `DataKey::Application(id)`.

## 22.4 Status

```txt
Pending
ApplicantStaked
CompanyStaked
Completed
Expired
Disputed
Resolved
```

## 22.5 Core functions

```rust
fn create_application(env: Env, applicant: Address, job_id: u64, token: Address, applicant_stake: i128, deadline: u64) -> u64;
fn company_accept_and_stake(env: Env, company: Address, application_id: u64, company_stake: i128);
fn mark_completed(env: Env, application_id: u64);
fn confirm_completed(env: Env, application_id: u64);
fn refund_expired(env: Env, application_id: u64);
fn open_dispute(env: Env, caller: Address, application_id: u64, evidence_uri: String, evidence_hash: BytesN<32>);
fn resolve_dispute(env: Env, resolver: Address, application_id: u64, applicant_payout: i128, company_payout: i128);
```

Every entrypoint calls `.require_auth()` on the relevant `Address` (applicant, company, or
resolver) before mutating state — the Soroban equivalent of Solidity's `msg.sender` checks and
the `onlyResolver` modifier. Stake transfers use `TokenClient` against a Stellar Asset Contract
(SAC) wrapping the stablecoin, not native `payable` value. See
`.agent/context/onchain/contract-design.md` for the full token-mechanics detail.

## 22.6 Events

Published via `env.events().publish(...)`:

```txt
ApplicationCreated(application_id, job_id, applicant, company, applicant_stake)
CompanyStaked(application_id, company, company_stake)
ApplicationCompleted(application_id)
StakeReleased(application_id, applicant_payout, company_payout)
ApplicationExpired(application_id)
DisputeOpened(application_id, opened_by, evidence_uri, evidence_hash)
DisputeResolved(application_id, applicant_payout, company_payout)
```

---

# 23. Staking Flow

## 23.1 Candidate apply and stake

```txt
1. Candidate memilih job.
2. Backend check:
   - user login
   - CandidateProfile CONFIRMED
   - Job ACTIVE
   - user bukan member company pemilik job
3. UI menampilkan stake amount.
4. User sign transaction via wallet (Soroban auth is per-invocation — no separate
   ERC20-style approve step before staking).
5. Contract create_application().
6. Backend sync event ApplicationCreated.
7. DB Application status = APPLICANT_STAKED.
```

## 23.2 Company accept and stake

```txt
1. Company membuka application.
2. Backend check:
   - user adalah CompanyMember
   - application valid
3. UI menampilkan company stake amount.
4. Company sign transaction (no separate approve step, same as above).
5. Contract company_accept_and_stake().
6. Backend sync event CompanyStaked.
7. DB Application status = COMPANY_STAKED.
```

## 23.3 Normal completion

```txt
1. Company mark completed.
2. Candidate confirm completed.
3. Contract release both stakes.
4. Backend sync event.
5. Application status = COMPLETED.
```

## 23.4 Expired refund

```txt
1. Candidate sudah stake.
2. Company tidak respond sampai deadline.
3. Candidate call refund_expired().
4. Contract return applicant stake.
5. Application status = EXPIRED.
```

## 23.5 Dispute

```txt
1. Candidate/company open dispute.
2. Evidence uploaded to R2/S3.
3. Evidence hash stored.
4. Evidence hash submitted onchain.
5. Dispute Summary Agent creates summary.
6. Admin reviews.
7. Admin resolver calls resolve_dispute().
8. Contract distributes payout.
9. Application status = RESOLVED.
```

---

# 24. Onchain Sync

## 24.0 Sync mechanism

Poll Soroban RPC's `getEvents` by ledger range (via `@stellar/stellar-sdk`'s
`SorobanRpc.Server`), analogous to an EVM sync job polling `eth_getLogs` by block range. Track
a `lastSyncedLedger` cursor (the Soroban equivalent of "last synced block").

## 24.1 Event sync job

It can live in:

```txt
apps/agent/src/jobs/run-onchain-sync.ts
```

Or for MVP:

```txt
apps/web/app/api/onchain/sync/route.ts
```

## 24.2 Sync rules

```txt
ApplicationCreated:
- Create or update Application
- Set status APPLICANT_STAKED
- Save applicantStakeTx

CompanyStaked:
- Set status COMPANY_STAKED
- Save companyStakeTx

ApplicationCompleted:
- Set status COMPLETED

ApplicationExpired:
- Set status EXPIRED

DisputeOpened:
- Set status DISPUTED

DisputeResolved:
- Set status RESOLVED
```

## 24.3 Duplicate protection

Use the table:

```txt
OnchainEvent
```

With unique:

```txt
txHash + eventName
```

---

# 25. Frontend UX

## 25.1 Dashboard utama

Route:

```txt
/dashboard
```

Display based on the entities owned by the user.

If the user is only a candidate:

```txt
- Candidate profile status
- Recommended jobs
- Active applications
```

If the user is only a company:

```txt
- Company list
- Active jobs
- Recommended talents
```

If the user is both:

```txt
- Candidate summary
- Company summary
- Mode switcher
```

## 25.2 Candidate dashboard

```txt
/candidate/dashboard
```

Cards:

```txt
- Profile completeness
- CV upload status
- Job recommendations
- Active applications
- Stake status
```

## 25.3 Company dashboard

```txt
/company/dashboard
```

Cards:

```txt
- Company profiles
- Active jobs
- Talent recommendations
- Pending applications
- Stake status
```

## 25.4 Company switcher

Because a user can own many companies:

```txt
/company/switch
```

The company-mode navbar should include:

```txt
Current Company: [dropdown]
```

---

# 26. Scheduler

## 26.1 MVP scheduler

Use:

```txt
node-cron
```

## 26.2 Production scheduler

Use:

```txt
BullMQ + Redis
```

## 26.3 Scheduled jobs

```txt
Every 6 hours:
- Run job matching for confirmed CandidateProfiles
- Run talent matching for active Jobs

Every 15 minutes:
- Sync onchain events
- Check expired applications

Every 1 hour:
- Send recommendation notifications

On demand:
- Parse CV
- Generate dispute summary
```

---

# 27. Security Rules

## 27.1 Auth security

```txt
- Semua protected route wajib punya session.
- Web login memakai Privy session.
- MiniPay login memakai wallet session.
- User identity harus di-normalize ke User table.
- Do not trust the wallet address from the client without a session or signature.
```

## 27.2 API security

```txt
- Validate every request with Zod.
- Company action wajib check CompanyMember.
- Admin action wajib User.userType = ADMIN.
- Agent trigger route wajib internal secret.
- Upload endpoint wajib rate limit.
```

## 27.3 Agent security

```txt
- Treat CV/job/evidence as untrusted data.
- Ignore instruction inside uploaded document.
- Validate all output with Zod.
- Log every AgentRun.
- Do not let AI call transaction helper.
```

## 27.4 Onchain security

```txt
- Validate Address.require_auth() on every state-changing entrypoint, and confirm the
  authorizing address matches the expected role (applicant/company/resolver).
- Validate status transition.
- Validate payout does not exceed escrowed amount.
- Resolver-only dispute settlement (explicit stored-address equality check).
- Follow checks-effects-interactions around TokenClient calls as defensive practice — Soroban's
  execution model makes classic reentrancy far less of a risk than Solidity, so this is good
  practice rather than a mandatory guard like ReentrancyGuard.
```

---

# 28. Development Execution Plan for Codex

> The repository, monorepo tooling, and web2 groundwork already exist (npm workspaces,
> Turborepo, `apps/web`, `apps/agent`, `contracts`, Drizzle/Postgres schema, Privy auth, API
> routes) — see root `README.md` for current state. The three phases below are **new
> capability added on top of that baseline**, not a from-scratch build order.

## Phase 1 — Complete the web2 product surface

Close remaining gaps in the already-mostly-built web2 flows so the product works fully
end-to-end without any chain dependency. Consolidates the former Data / Auth / Onboarding /
Candidate / Company / Agents / Matching phases.

Tasks:

```txt
1. Close remaining gaps in onboarding, candidate, and company flows.
2. Harden the Mastra agent pipeline (CV profile, job matching, talent matching, dispute
   summary) and the matching/recommendation loop.
3. Verify anti self-apply and multi-mode rules hold across all surfaces.
4. Ensure applications can reach an "agreed" state using the existing DB-tracked
   (simulated) stake — no chain transaction required yet.
```

Acceptance criteria:

```txt
A user can sign in, complete onboarding, build a profile (candidate) or post a job
(company/recruiter), receive AI-generated recommendations, and reach an agreed application
state — all without touching a wallet or blockchain.
```

## Phase 2 — Stellar/Soroban chain foundation

Implement the real `ShireEscrow` Soroban contract and the wallet plumbing to call it,
replacing the simulated stake. Consolidates the former Smart Contract and Wallet + Staking UI
phases. Highest-risk, most novel phase (new language, new SDK) — isolated on purpose.

Tasks:

```txt
1. Build ShireEscrow (Soroban/Rust) per .agent/context/onchain/contract-design.md:
   create_application, company_accept_and_stake, mark_completed, confirm_completed,
   refund_expired, open_dispute, resolve_dispute.
2. Add contract tests (soroban-sdk testutils) and deploy to Stellar testnet.
3. Wire up a Stellar Wallets Kit connector (Freighter, xBull, Albedo, Lobstr) alongside
   Privy (Privy stays login/identity only).
4. Add Apply & Stake / Company Accept & Stake UI against the deployed contract.
5. Add transaction status UI; store tx hash / ledger reference.
```

Acceptance criteria:

```txt
Candidate can stake real testnet stablecoin into the deployed contract.
Company can accept and stake.
Funds are verifiably locked in the contract (checkable via Stellar Expert).
UI displays live transaction status.
```

## Phase 3 — Chain-dependent product features

Read chain state back into the product and close the dispute loop. Depends entirely on
Phase 2's deployed contract. Consolidates the former Onchain Sync and Dispute MVP phases.

Tasks:

```txt
1. Add event sync job polling Soroban getEvents by ledger range.
2. Save OnchainEvent (txHash + eventName dedupe key); update Application status.
3. Add evidence upload + hash (hash submitted onchain, evidence itself stays off-chain).
4. Wire the existing dispute-summary agent to real disputes.
5. Build the admin resolver action calling resolve_dispute on the real contract.
```

Acceptance criteria:

```txt
DB application status correctly and idempotently follows real contract events.
A full dispute can be opened, get an AI summary, and be resolved by an admin with real
funds moving per the resolution.
```

---

# 29. MVP Scope

## Must-have

```txt
- Privy wallet login
- MiniPay wallet compatibility abstraction
- User sync by wallet
- Multi-mode onboarding
- Candidate profile
- CV upload
- AI profile draft
- Company creation
- CompanyMember ownership
- Job creation
- Job recommendations
- Talent recommendations
- Anti self-apply rule
- Candidate apply with stake
- Company accept with stake
- Onchain escrow
- Basic dispute
```

## Not for MVP

```txt
- DAO dispute
- Reputation NFT
- Auto apply
- Auto invite
- Auto salary negotiation
- Interview scheduling
- Complex fraud detection
- Multi-chain support
```

---

# 30. Final Codex Instruction

Implementation must follow this order (see §28 for the 3-phase grouping):

```txt
Phase 1 — Web2 product surface:
  1. Close onboarding/candidate/company gaps
  2. Harden Mastra agents + matching
Phase 2 — Stellar/Soroban chain foundation:
  3. ShireEscrow (Soroban) contract + tests + testnet deploy
  4. Stellar Wallets Kit wallet connector
  5. Apply & Stake / Accept & Stake UI
Phase 3 — Chain-dependent product features:
  6. Onchain sync (Soroban getEvents)
  7. Dispute MVP (evidence hash, resolver action)
```

Things that must not go wrong:

```txt
- Do not set `User.role = CANDIDATE/COMPANY`.
- Do not limit the user to one mode only.
- Do not let AI perform transactions.
- Do not store sensitive CV/profile data onchain.
- Do not recommend that a user apply to their own company.
- Do not let AI resolve disputes automatically.
```

Final architecture:

```txt
Next.js = product app + API
Privy = wallet authentication / SIWE (login + identity only)
MiniPay = wallet environment for Mini App
Mastra = AI agent orchestration
Prisma = ORM
PostgreSQL = offchain database
Soroban Smart Contract = staking escrow (on Stellar)
Stellar Wallets Kit + @stellar/stellar-sdk = wallet connection + contract interaction
```

Final model:

```txt
One wallet = one Shire user identity.
One user can have CandidateProfile.
One user can own or manage many Companies/Agencies.
Agent runs based on active entities, not fixed roles.
Stake role is defined per application.
```

Final principle:

```txt
AI finds.
User approves.
Stake locks.
Workflow validates.
Resolver decides.
Contract settles.
```
