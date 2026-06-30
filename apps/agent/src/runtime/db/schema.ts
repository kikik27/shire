import {
  boolean,
  customType,
  index,
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
  MATCHING_EVALUATION_STATUSES,
  PROFILE_STATUSES,
  RECOMMENDATION_STATUSES,
  RECOMMENDATION_TYPES,
} from "@shire/shared";

/**
 * Agent-side mirror of the web Drizzle schema. Only the tables and columns
 * the matching pipeline reads or writes. Kept in sync with
 * apps/web/lib/server/db/schema.ts by convention (both pull their enum values
 * from @shire/shared). The agent never owns these tables; it is a read-mostly
 * client that additionally writes recommendations + agent_runs rows.
 */

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
};

export const jobStatusEnum = pgEnum("job_status", [
  "DRAFT",
  "ACTIVE",
  "CLOSED",
  "EXPIRED",
  "FLAGGED",
]);
export const profileStatusEnum = pgEnum("profile_status", [...PROFILE_STATUSES]);
export const recommendationTypeEnum = pgEnum("recommendation_type", [
  ...RECOMMENDATION_TYPES,
]);
export const recommendationStatusEnum = pgEnum("recommendation_status", [
  ...RECOMMENDATION_STATUSES,
]);
export const matchingEvaluationStatusEnum = pgEnum(
  "matching_evaluation_status",
  [...MATCHING_EVALUATION_STATUSES],
);
export const agentRunStatusEnum = pgEnum("agent_run_status", [
  "SUCCESS",
  "FAILED",
  "PARTIAL",
]);

const bytea = customType<{ data: Buffer; default: false }>({
  dataType() {
    return "bytea";
  },
});

export const appUsers = pgTable("app_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  privyUserId: text("privy_user_id").notNull().unique(),
  walletAddress: text("wallet_address").unique(),
});

export const candidateProfiles = pgTable("candidate_profiles", {
  userId: uuid("user_id").primaryKey(),
  profile: jsonb("profile")
    .$type<Record<string, unknown>>()
    .default({})
    .notNull(),
  profileStatus: profileStatusEnum("profile_status").default("DRAFT").notNull(),
  embeddingText: text("embedding_text"),
  embedding: bytea("embedding"),
  ...timestamps,
});

export const jobs = pgTable("jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  recruiterUserId: uuid("recruiter_user_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  companyName: text("company_name").notNull(),
  location: text("location").notNull(),
  remote: boolean("remote").default(true).notNull(),
  salaryRange: text("salary_range").notNull(),
  jobType: text("job_type").notNull(),
  experienceLevel: text("experience_level").notNull(),
  skillsRequired: jsonb("skills_required")
    .$type<string[]>()
    .default([])
    .notNull(),
  status: jobStatusEnum("status").default("DRAFT").notNull(),
  stakeAmount: numeric("stake_amount", { precision: 12, scale: 2 })
    .default("0")
    .notNull(),
  riskLevel: text("risk_level").default("UNKNOWN").notNull(),
  riskScore: integer("risk_score").default(0).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ...timestamps,
});

export const applications = pgTable(
  "applications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id").notNull(),
    candidateUserId: uuid("candidate_user_id").notNull(),
    status: text("status").default("APPLIED").notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("applications_job_candidate_unique").on(table.jobId, table.candidateUserId)],
);

export const recommendations = pgTable(
  "recommendations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    type: recommendationTypeEnum("type").notNull(),
    candidateUserId: uuid("candidate_user_id").notNull(),
    recruiterUserId: uuid("recruiter_user_id"),
    jobId: uuid("job_id"),
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
);

export const matchingEvaluations = pgTable(
  "matching_evaluations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    candidateUserId: uuid("candidate_user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    inputHash: text("input_hash").notNull(),
    scoringVersion: text("scoring_version").notNull(),
    status: matchingEvaluationStatusEnum("status").notNull(),
    ruleScore: integer("rule_score"),
    matchScore: integer("match_score"),
    confidence: numeric("confidence", { precision: 3, scale: 2 }),
    recommendedAction: text("recommended_action"),
    reasons: jsonb("reasons").$type<string[]>().default([]).notNull(),
    missingRequirements: jsonb("missing_requirements")
      .$type<string[]>()
      .default([])
      .notNull(),
    riskFlags: jsonb("risk_flags").$type<string[]>().default([]).notNull(),
    failureCode: text("failure_code"),
    attemptCount: integer("attempt_count").default(0).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("matching_evaluations_candidate_job_unique").on(
      table.candidateUserId,
      table.jobId,
    ),
    index("matching_evaluations_status_idx").on(table.status),
    index("matching_evaluations_updated_at_idx").on(table.updatedAt),
  ],
);

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
});
