import { z } from "zod";

const optionalUrl = z
  .union([z.string().url("Enter a valid URL"), z.literal("")])
  .optional();

export const candidateProfileSchema = z.object({
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
  languages: z.array(z.string()).default([]),
  salaryExpectation: z.string().optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).default("PUBLIC"),
});

export type CandidateProfileInput = z.input<typeof candidateProfileSchema>;
export type CandidateProfileValues = z.output<typeof candidateProfileSchema>;

export const recruiterProfileSchema = z.object({
  companyName: z.string().min(2, "Add your company name"),
  companyWebsite: optionalUrl,
  companyDescription: z.string().min(10, "Describe your company").max(400),
  contactEmail: z.union([z.string().email("Enter a valid email"), z.literal("")]).optional(),
  location: z.string().optional(),
});

export type RecruiterProfileValues = z.output<typeof recruiterProfileSchema>;

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
