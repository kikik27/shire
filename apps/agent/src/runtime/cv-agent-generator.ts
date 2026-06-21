import { RequestContext } from "@mastra/core/request-context";

import { cvProfileAgent } from "../mastra/agents/cv-profile.agent";
import {
  CandidateProfileDraftSchema,
  type CandidateProfileDraft,
} from "./candidate-profile";
import type {
  CvGenerationResult,
} from "./cv-normalizer";
import { getCapabilityPolicy } from "./model-policy";
import { env } from "../env";

type CvAgentResponse = {
  object: unknown;
  response?: { modelId?: string };
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
};

type CvAgent = {
  generate: (
    messages: unknown,
    options: unknown,
  ) => Promise<CvAgentResponse>;
};

function containsEvidence(rawCv: string, value: string | undefined) {
  if (!value?.trim()) {
    return true;
  }
  return rawCv.toLocaleLowerCase().includes(value.trim().toLocaleLowerCase());
}

function groundCandidateProfile(
  profile: CandidateProfileDraft,
  rawCv: string,
): CandidateProfileDraft {
  const missing = new Set(profile.missingFields);
  const skills = profile.skills.filter((skill) => containsEvidence(rawCv, skill));
  const workExperience = profile.workExperience.filter((entry) =>
    [entry.company, entry.role, entry.startDate, entry.endDate].every((value) =>
      containsEvidence(rawCv, value),
    ),
  );
  const education = profile.education.filter((entry) =>
    [entry.institution, entry.degree, entry.year].every((value) =>
      containsEvidence(rawCv, value),
    ),
  );
  const preferredRoles = profile.preferredRoles.filter((role) =>
    containsEvidence(rawCv, role),
  );

  if (workExperience.length !== profile.workExperience.length) {
    missing.add("workExperience");
  }
  if (education.length !== profile.education.length) {
    missing.add("education");
  }

  return CandidateProfileDraftSchema.parse({
    ...profile,
    fullName: containsEvidence(rawCv, profile.fullName)
      ? profile.fullName
      : undefined,
    skills,
    workExperience,
    education,
    preferredRoles,
    expectedSalary:
      profile.expectedSalary &&
      [
        profile.expectedSalary.min?.toString(),
        profile.expectedSalary.max?.toString(),
        profile.expectedSalary.currency,
      ].every((value) => containsEvidence(rawCv, value))
        ? profile.expectedSalary
        : undefined,
    location: containsEvidence(rawCv, profile.location)
      ? profile.location
      : undefined,
    workPreference: containsEvidence(rawCv, profile.workPreference)
      ? profile.workPreference
      : undefined,
    portfolioUrl: containsEvidence(rawCv, profile.portfolioUrl)
      ? profile.portfolioUrl
      : undefined,
    githubUrl: containsEvidence(rawCv, profile.githubUrl)
      ? profile.githubUrl
      : undefined,
    linkedinUrl: containsEvidence(rawCv, profile.linkedinUrl)
      ? profile.linkedinUrl
      : undefined,
    missingFields: [...missing],
  });
}

function resolveReportedModel(modelId: string | undefined) {
  const chain = env.chatModelChains.cvNormalization;
  if (!modelId) {
    return chain[0] ?? "cv-normalization/unknown";
  }

  return (
    chain.find(
      (configured) =>
        configured === modelId || configured.endsWith(`/${modelId}`),
    ) ?? modelId
  );
}

export async function generateCandidateProfile(input: {
  agent?: CvAgent;
  candidateId: string;
  jobId: string;
  rawCv: string;
}): Promise<CvGenerationResult & { profile: CandidateProfileDraft }> {
  const requestContext = new RequestContext();
  requestContext.set("model-capability", "cv-normalization");
  requestContext.set("job-id", input.jobId);

  const agent = input.agent ?? (cvProfileAgent as unknown as CvAgent);
  const response = await agent.generate(
    [
      {
        role: "user",
        content: [
          "Normalize this CV into the required candidate profile schema.",
          "Do not invent facts. Put uncertain or absent facts in missingFields.",
          input.rawCv,
        ].join("\n\n"),
      },
    ],
    {
      requestContext,
      memory: {
        thread: `cv-parse:${input.candidateId}`,
        resource: `candidate:${input.candidateId}`,
      },
      structuredOutput: {
        schema: CandidateProfileDraftSchema,
      },
      maxOutputTokens:
        getCapabilityPolicy("cv-normalization").maxOutputTokens,
    },
  );

  const profile = groundCandidateProfile(
    CandidateProfileDraftSchema.parse(response.object),
    input.rawCv,
  );

  return {
    profile,
    model: resolveReportedModel(response.response?.modelId),
    usage: response.usage,
  };
}
