import {
  boolean,
  customType,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import {
  PROFILE_STATUSES,
  RECOMMENDATION_STATUSES,
  RECOMMENDATION_TYPES,
} from "@shire/shared";

// Postgres bytea column. drizzle-orm has no built-in bytea builder in this
// version, so define one via customType. Used only for the diagnostic
// candidate embedding cache.
const bytea = customType<{ data: Buffer; default: false }>({
  dataType() {
    return "bytea";
  },
});

export const userTypeEnum = pgEnum("user_type", ["USER", "ADMIN"]);
export const userModeEnum = pgEnum("user_mode", [
  "CANDIDATE",
  "RECRUITER",
  "BOTH",
]);
export const jobStatusEnum = pgEnum("job_status", [
  "DRAFT",
  "ACTIVE",
  "CLOSED",
  "EXPIRED",
  "FLAGGED",
]);
export const applicationStatusEnum = pgEnum("application_status", [
  "SAVED",
  "APPLIED",
  "REVIEWED",
  "INTERVIEW",
  "OFFERED",
  "HIRED",
  "REJECTED",
  "WITHDRAWN",
  "DISPUTED",
]);
export const agentRunStatusEnum = pgEnum("agent_run_status", [
  "SUCCESS",
  "FAILED",
  "PARTIAL",
]);

// Matching enums — sourced from @shire/shared so both apps agree on the values.
export const profileStatusEnum = pgEnum("profile_status", [...PROFILE_STATUSES]);
export const recommendationTypeEnum = pgEnum("recommendation_type", [
  ...RECOMMENDATION_TYPES,
]);
export const recommendationStatusEnum = pgEnum("recommendation_status", [
  ...RECOMMENDATION_STATUSES,
]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
};

export const appUsers = pgTable("app_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  privyUserId: text("privy_user_id").notNull().unique(),
  walletAddress: text("wallet_address").unique(),
  email: text("email").unique(),
  userType: userTypeEnum("user_type").default("USER").notNull(),
  activeMode: userModeEnum("active_mode"),
  onboardingDone: boolean("onboarding_done").default(false).notNull(),
  ...timestamps,
}).enableRLS();

export const candidateProfiles = pgTable("candidate_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => appUsers.id, { onDelete: "cascade" }),
  profile: jsonb("profile")
    .$type<Record<string, unknown>>()
    .default({})
    .notNull(),
  // Matching eligibility gate. The matching hard-filter requires CONFIRMED
  // before a candidate participates in job/talent matching.
  profileStatus: profileStatusEnum("profile_status").default("DRAFT").notNull(),
  // Diagnostic cache of the embedding the agent computed for retrieval. The
  // authoritative vector index lives in the agent's libSQL store; this column
  // mirrors it for inspection/debugging only.
  embeddingText: text("embedding_text"),
  embedding: bytea("embedding"),
  ...timestamps,
}).enableRLS();

export const recruiterProfiles = pgTable("recruiter_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => appUsers.id, { onDelete: "cascade" }),
  profile: jsonb("profile")
    .$type<Record<string, unknown>>()
    .default({})
    .notNull(),
  ...timestamps,
}).enableRLS();

export const jobs = pgTable("jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  recruiterUserId: uuid("recruiter_user_id")
    .notNull()
    .references(() => appUsers.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  companyName: text("company_name").notNull(),
  location: text("location").notNull(),
  remote: boolean("remote").default(true).notNull(),
  salaryRange: text("salary_range").notNull(),
  jobType: text("job_type").notNull(),
  experienceLevel: text("experience_level").notNull(),
  skillsRequired: jsonb("skills_required").$type<string[]>().default([]).notNull(),
  status: jobStatusEnum("status").default("DRAFT").notNull(),
  stakeAmount: numeric("stake_amount", { precision: 12, scale: 2 })
    .default("0")
    .notNull(),
  stakeToken: text("stake_token").default("cUSD").notNull(),
  candidateStakeRequired: boolean("candidate_stake_required")
    .default(false)
    .notNull(),
  candidateStakeAmount: numeric("candidate_stake_amount", {
    precision: 12,
    scale: 2,
  }),
  riskLevel: text("risk_level").default("UNKNOWN").notNull(),
  riskScore: integer("risk_score").default(0).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ...timestamps,
}).enableRLS();

export const applications = pgTable(
  "applications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    candidateUserId: uuid("candidate_user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    status: applicationStatusEnum("status").default("APPLIED").notNull(),
    message: text("message").notNull(),
    matchScore: integer("match_score").default(0).notNull(),
    riskScore: integer("risk_score").default(0).notNull(),
    stakeTx: text("stake_tx"),
    stakeAmount: numeric("stake_amount", { precision: 12, scale: 2 }),
    ...timestamps,
  },
  (table) => [uniqueIndex("applications_job_candidate_unique").on(table.jobId, table.candidateUserId)],
).enableRLS();

export const agentRuns = pgTable("agent_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  agentName: text("agent_name").notNull(),
  workflowName: text("workflow_name"),
  status: agentRunStatusEnum("status").notNull(),
  input: jsonb("input").$type<Record<string, unknown>>(),
  output: jsonb("output").$type<Record<string, unknown>>(),
  errorMessage: text("error_message"),
  latencyMs: integer("latency_ms"),
  ...timestamps,
}).enableRLS();

/**
 * Persisted matching recommendations. Written by apps/agent after the
 * Filter → Rule Score → Rerank pipeline; read by apps/web dashboards.
 *
 * A recommendation is unique per (candidate, job, type): re-running matching
 * upserts the row instead of duplicating. The `recommendedAction` column stores
 * the MatchingOutput action discriminator (SUGGEST_APPLY / SUGGEST_INVITE /
 * SAVE_ONLY / IGNORE); rows are only persisted when action != IGNORE.
 */
export const recommendations = pgTable(
  "recommendations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    type: recommendationTypeEnum("type").notNull(),
    candidateUserId: uuid("candidate_user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    recruiterUserId: uuid("recruiter_user_id").references(() => appUsers.id, {
      onDelete: "cascade",
    }),
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "cascade" }),
    matchScore: integer("match_score").default(0).notNull(),
    confidence: numeric("confidence", { precision: 3, scale: 2 }),
    reasons: jsonb("reasons").$type<string[]>().default([]).notNull(),
    missingRequirements: jsonb("missing_requirements")
      .$type<string[]>()
      .default([])
      .notNull(),
    riskFlags: jsonb("risk_flags").$type<string[]>().default([]).notNull(),
    recommendedAction: text("recommended_action").notNull(),
    status: recommendationStatusEnum("status").default("NEW").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("recommendations_candidate_job_type_unique").on(
      table.candidateUserId,
      table.jobId,
      table.type,
    ),
  ],
).enableRLS();
