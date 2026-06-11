/**
 * Shared domain types for the Shire "Stake n Hiring" app.
 * These mirror the onchain registry/stake-vault structs and the backend schema so the
 * frontend can be swapped from the demo store to real wagmi/API calls without reshaping data.
 */

// --- Onchain role registry (ShireRegistryUpgradeable.roleType) ---
export const RoleType = {
  None: 0,
  Candidate: 1,
  Recruiter: 2,
  Both: 3,
} as const;
export type RoleType = (typeof RoleType)[keyof typeof RoleType];

export type AppRole = "candidate" | "recruiter" | "admin";

// --- Stake vault enums (ShireStakeVaultUpgradeable) ---
export const StakeType = {
  JobPost: 1,
  Application: 2,
  Interview: 3,
  Offer: 4,
  Bounty: 5,
} as const;
export type StakeType = (typeof StakeType)[keyof typeof StakeType];

export const StakeStatus = {
  Locked: 1,
  Refunded: 2,
  Slashed: 3,
  Released: 4,
  Cancelled: 5,
} as const;
export type StakeStatus = (typeof StakeStatus)[keyof typeof StakeStatus];

// --- Offchain domain enums ---
export type ApplicationStatus =
  | "SAVED"
  | "APPLIED"
  | "REVIEWED"
  | "INTERVIEW"
  | "OFFERED"
  | "HIRED"
  | "REJECTED"
  | "WITHDRAWN"
  | "DISPUTED";

export const APPLICATION_FLOW: ApplicationStatus[] = [
  "APPLIED",
  "REVIEWED",
  "INTERVIEW",
  "OFFERED",
  "HIRED",
];

export type JobStatus = "DRAFT" | "ACTIVE" | "CLOSED" | "EXPIRED" | "FLAGGED";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";

export type VerificationStatus = "UNVERIFIED" | "PENDING" | "VERIFIED";

export type JobType = "FULL_TIME" | "PART_TIME" | "CONTRACT" | "FREELANCE" | "INTERNSHIP";

export type ExperienceLevel = "INTERN" | "JUNIOR" | "MID" | "SENIOR" | "LEAD";

// --- Entities ---
export type TokenSymbol = "cUSD" | "USDC" | "CELO";

export type CandidateProfile = {
  displayName: string;
  bio: string;
  skills: string[];
  roleTargets: string[];
  experienceLevel: ExperienceLevel;
  portfolioUrl?: string;
  githubUrl?: string;
  linkedinUrl?: string;
  xUrl?: string;
  location?: string;
  timezone?: string;
  languages: string[];
  salaryExpectation?: string;
  visibility: "PUBLIC" | "PRIVATE";
};

export type RecruiterProfile = {
  companyName: string;
  companyWebsite?: string;
  companyDescription: string;
  contactEmail?: string;
  location?: string;
  verificationStatus: VerificationStatus;
  trustLevel: number; // 0-100
  completedHires: number;
  disputeCount: number;
};

export type Job = {
  id: string;
  recruiterId: string;
  title: string;
  description: string;
  companyName: string;
  location: string;
  remote: boolean;
  salaryRange: string;
  jobType: JobType;
  experienceLevel: ExperienceLevel;
  skillsRequired: string[];
  status: JobStatus;
  stakeAmount: number;
  stakeToken: TokenSymbol;
  stakeStatus: StakeStatus;
  candidateStakeRequired: boolean;
  candidateStakeAmount?: number;
  riskLevel: RiskLevel;
  riskScore: number;
  createdAt: number;
  expiresAt: number;
};

export type Application = {
  id: string;
  jobId: string;
  candidateId: string;
  status: ApplicationStatus;
  message: string;
  matchScore: number;
  riskScore: number;
  stakeId?: string;
  appliedAt: number;
  updatedAt: number;
};

export type Stake = {
  id: string;
  userId: string;
  jobId?: string;
  applicationId?: string;
  stakeType: StakeType;
  amount: number;
  token: TokenSymbol;
  status: StakeStatus;
  txHash: string;
  reason?: string;
  createdAt: number;
  updatedAt: number;
};

export type Dispute = {
  id: string;
  reporterId: string;
  reportedLabel: string;
  jobId?: string;
  stakeId?: string;
  reason: string;
  status: "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "REJECTED";
  aiSummary?: string;
  adminDecision?: string;
  createdAt: number;
};

// --- AI agent outputs ---
export type MatchResult = {
  matchScore: number;
  recommendation: "Strong Match" | "Good Match" | "Partial Match" | "Weak Match";
  reason: string;
  missingSkills: string[];
  applyAdvice: string;
};

export type RiskResult = {
  riskLevel: RiskLevel;
  riskScore: number;
  flags: string[];
  recommendation: string;
  confidence: number;
};

export type StakeRecommendation = {
  recommendedRecruiterStake: string;
  candidateStakeRequired: boolean;
  stakeReason: string;
  refundPolicy: string;
};

export type OfferSafety = {
  offerSafetyLevel: RiskLevel;
  flags: string[];
  recommendation: string;
};

export type ApplyKit = {
  coverLetter: string;
  recruiterDM: string;
  shortIntro: string;
  followUp: string;
};

export type Notification = {
  id: string;
  text: string;
  time: string;
  unread: boolean;
};
