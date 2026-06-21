/**
 * Recommendation persistence contract shared by apps/agent (writes) and
 * apps/web (reads). These literal arrays are the single source of truth that
 * the Drizzle pgEnums in both apps are generated from, so the two schemas
 * cannot drift.
 */

export const RECOMMENDATION_TYPES = [
  "JOB_TO_CANDIDATE",
  "TALENT_TO_COMPANY",
] as const;
export type RecommendationType = (typeof RECOMMENDATION_TYPES)[number];

export const RECOMMENDATION_STATUSES = [
  "NEW",
  "SEEN",
  "ACCEPTED",
  "REJECTED",
  "EXPIRED",
] as const;
export type RecommendationStatus = (typeof RECOMMENDATION_STATUSES)[number];

/**
 * Candidate profile lifecycle. The matching hard-filter requires
 * profileStatus = CONFIRMED before a candidate is eligible.
 */
export const PROFILE_STATUSES = [
  "DRAFT",
  "PENDING_REVIEW",
  "CONFIRMED",
  "NEEDS_UPDATE",
] as const;
export type ProfileStatus = (typeof PROFILE_STATUSES)[number];

export const CONFIRMED_PROFILE_STATUS: ProfileStatus = "CONFIRMED";
