import { z } from "zod";

export const CandidateProfileDraftSchema = z.object({
  fullName: z.string().optional(),
  headline: z.string().optional(),
  summary: z.string().optional(),
  skills: z.array(z.string()).default([]),
  workExperience: z
    .array(
      z.object({
        company: z.string().optional(),
        role: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        description: z.string().optional(),
      }),
    )
    .default([]),
  education: z
    .array(
      z.object({
        institution: z.string().optional(),
        degree: z.string().optional(),
        year: z.string().optional(),
      }),
    )
    .default([]),
  preferredRoles: z.array(z.string()).default([]),
  expectedSalary: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
      currency: z.string().optional(),
    })
    .optional(),
  location: z.string().optional(),
  workPreference: z.string().optional(),
  portfolioUrl: z.url().optional(),
  githubUrl: z.url().optional(),
  linkedinUrl: z.url().optional(),
  profileConfidence: z.number().min(0).max(1),
  missingFields: z.array(z.string()).default([]),
});

export type CandidateProfileDraft = z.infer<
  typeof CandidateProfileDraftSchema
>;

export function buildCandidateEmbeddingText(profile: CandidateProfileDraft) {
  return [
    profile.headline && `Headline: ${profile.headline}`,
    profile.summary && `Summary: ${profile.summary}`,
    profile.skills.length > 0 && `Skills: ${profile.skills.join(", ")}`,
    profile.preferredRoles.length > 0 &&
      `Preferred roles: ${profile.preferredRoles.join(", ")}`,
    profile.location && `Location: ${profile.location}`,
    profile.workPreference && `Work preference: ${profile.workPreference}`,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}
