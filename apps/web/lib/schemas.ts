import { z } from "zod";

const optionalUrl = z
  .union([z.string().url("Enter a valid URL"), z.literal("")])
  .optional();

const candidateProfileFields = {
  displayName: z.string().min(2, "Add your name"),
  bio: z.string().min(10, "A short bio helps recruiters").max(400),
  skills: z.array(z.string()).min(1, "Add at least one skill"),
  roleTargets: z.array(z.string()).min(1, "Add at least one target role"),
  experienceLevel: z.enum(["INTERN", "JUNIOR", "MID", "SENIOR", "LEAD"]),
  portfolioUrl: optionalUrl,
  githubUrl: optionalUrl,
  linkedinUrl: optionalUrl,
  xUrl: optionalUrl,
  location: z.string().optional(),
  timezone: z.string().optional(),
  languages: z.array(z.string()),
  salaryExpectation: z.string().optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE"]),
};

export const candidateProfileSchema = z.object({
  ...candidateProfileFields,
  languages: candidateProfileFields.languages.default([]),
  visibility: candidateProfileFields.visibility.default("PUBLIC"),
});

export type CandidateProfileInput = z.input<typeof candidateProfileSchema>;
export type CandidateProfileValues = z.output<typeof candidateProfileSchema>;

export const persistedCandidateProfileSchema = z
  .strictObject(candidateProfileFields)
  .transform((values) => ({
    ...values,
    portfolioUrl: values.portfolioUrl || undefined,
    githubUrl: values.githubUrl || undefined,
    linkedinUrl: values.linkedinUrl || undefined,
    xUrl: values.xUrl || undefined,
  }));

const recruiterProfileFields = {
  companyName: z.string().min(2, "Add your company name"),
  companyWebsite: optionalUrl,
  companyDescription: z.string().min(10, "Describe your company").max(400),
  contactEmail: z.union([z.string().email("Enter a valid email"), z.literal("")]).optional(),
  location: z.string().optional(),
};

export const recruiterProfileSchema = z.strictObject(recruiterProfileFields);

export type RecruiterProfileInput = z.input<typeof recruiterProfileSchema>;
export type RecruiterProfileValues = z.output<typeof recruiterProfileSchema>;

export const persistedRecruiterProfileSchema = z
  .strictObject(recruiterProfileFields)
  .transform((values) => ({
    ...values,
    companyWebsite: values.companyWebsite || undefined,
    contactEmail: values.contactEmail || undefined,
    location: values.location || undefined,
  }));

export const storedRecruiterProfileSchema = z
  .strictObject({
    ...recruiterProfileFields,
    verificationStatus: z.enum(["UNVERIFIED", "PENDING", "VERIFIED"]),
    trustLevel: z.number().min(0).max(100),
    completedHires: z.number().int().nonnegative(),
    disputeCount: z.number().int().nonnegative(),
  })
  .transform((values) => ({
    ...values,
    companyWebsite: values.companyWebsite || undefined,
    contactEmail: values.contactEmail || undefined,
    location: values.location || undefined,
  }));

export const jobDraftSchema = z.object({
  title: z.string().min(4, "Add a clear job title"),
  description: z.string().min(40, "Describe the role in a bit more detail"),
  location: z.string().min(2, "Add a location"),
  remote: z.boolean().default(true),
  salaryRange: z.string().min(1, "Add a salary range"),
  jobType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT", "FREELANCE", "INTERNSHIP"]),
  experienceLevel: z.enum(["INTERN", "JUNIOR", "MID", "SENIOR", "LEAD"]),
  skillsRequired: z.array(z.string()).min(1, "Add at least one required skill"),
  candidateStakeRequired: z.boolean().default(false),
  candidateStakeAmount: z.coerce.number().min(0).optional(),
});

export type JobDraftValues = z.output<typeof jobDraftSchema>;

export const applyJobSchema = z.strictObject({
  message: z.string().min(10, "Add a short note for the recruiter").max(1000),
  stakeAmount: z.coerce.number().min(0).optional(),
  stakeTx: z.string().min(1).optional(),
  onchainApplicationId: z
    .string()
    .regex(/^\d+$/, "onchainApplicationId must be a numeric string")
    .optional(),
});

export type ApplyJobValues = z.output<typeof applyJobSchema>;

export const setActiveModeSchema = z.strictObject({
  activeMode: z.enum(["CANDIDATE", "RECRUITER", "BOTH"]),
});

export const selectModeSchema = z.strictObject({
  mode: z.enum(["CANDIDATE", "RECRUITER", "BOTH"]),
});
