export const PLATFORM_STAKE_STATUSES = [
  "LOCKED",
  "REFUNDED",
  "SLASHED",
  "RELEASED",
  "CANCELLED",
] as const;

export type PlatformStakeStatus =
  (typeof PLATFORM_STAKE_STATUSES)[number];

export const PLATFORM_STAKE_TYPES = [
  "JOB_POST",
  "APPLICATION",
  "INTERVIEW",
  "OFFER",
  "BOUNTY",
] as const;

export type PlatformStakeType = (typeof PLATFORM_STAKE_TYPES)[number];

export const DISPUTE_STATUSES = [
  "OPEN",
  "UNDER_REVIEW",
  "RESOLVED",
  "REJECTED",
] as const;

export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];
