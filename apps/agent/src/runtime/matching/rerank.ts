import { RequestContext } from "@mastra/core/request-context";

import { jobMatchingAgent } from "../../mastra/agents/job-matching.agent";
import { talentMatchingAgent } from "../../mastra/agents/talent-matching.agent";
import {
  MatchingOutputSchema,
  recommendActionFromScore,
  type MatchingOutput,
} from "@shire/shared";
import { logger } from "../logger";
import { scoreMatch, ruleScoreReasons, type RuleScoreResult } from "./rule-score";
import type { CandidateMatchInput, JobMatchInput } from "./types";

const matchLogger = logger.child({ component: "matching-rerank" });

type RerankCapability = "job-rerank" | "talent-rerank";

type RerankAgent = {
  generate: (
    messages: unknown,
    options: unknown,
  ) => Promise<{
    object?: unknown;
    text?: string;
    content?: string;
    response?: { modelId?: string };
  }>;
};

export interface RerankDependencies {
  /** Override the agent (tests pass a mock). Defaults to the registered agent. */
  jobAgent?: RerankAgent;
  talentAgent?: RerankAgent;
}

export type RerankResult = {
  output: MatchingOutput;
  /** Whether the model was actually consulted (false = deterministic fallback). */
  llmInvoked: boolean;
};

/**
 * Rerank a (candidate, job) pair using the capability model, then merge with
 * the deterministic rule score. Retrieval-first guarantee: if the model fails
 * or returns unusable output, we fall back to the rule score with a derived
 * recommendedAction. Never fail the whole pipeline on a provider hiccup.
 */
export async function rerankMatch(
  candidate: CandidateMatchInput,
  job: JobMatchInput,
  ruleScore: RuleScoreResult,
  capability: RerankCapability,
  dependencies: RerankDependencies = {},
): Promise<RerankResult> {
  const agent =
    (capability === "job-rerank"
      ? dependencies.jobAgent
      : dependencies.talentAgent) ??
    (capability === "job-rerank"
      ? (jobMatchingAgent as unknown as RerankAgent)
      : (talentMatchingAgent as unknown as RerankAgent));

  const requestContext = new RequestContext();
  requestContext.set("model-capability", capability);

  try {
    const response = await agent.generate(
      [
        {
          role: "user",
          content: [
            "Evaluate the fit between this candidate and this job.",
            "Use the provided rule-score breakdown as a strong prior; adjust only when you have clear evidence.",
            "Return only a valid JSON object. Do not wrap it in markdown.",
            "Required JSON shape:",
            '{"matchScore": number, "confidence": number, "reasons": string[], "missingRequirements": string[], "riskFlags": string[], "recommendedAction": "SUGGEST_APPLY" | "SUGGEST_INVITE" | "SAVE_ONLY" | "IGNORE"}',
            "",
            `Candidate: ${describeCandidate(candidate)}`,
            `Job: ${describeJob(job)}`,
            `Rule score: ${ruleScore.score}/100 (skill ${Math.round(ruleScore.components.skill.raw * 100)}%, experience ${Math.round(ruleScore.components.experience.raw * 100)}%, location ${Math.round(ruleScore.components.location.raw * 100)}%, salary ${Math.round(ruleScore.components.salary.raw * 100)}%).`,
          ].join("\n"),
        },
      ],
      {
        requestContext,
        temperature: 0,
      },
    );

    const parsed = parseRerankResponse(response);
    if (parsed.success) {
      return { output: parsed.data, llmInvoked: true };
    }

    matchLogger.warn(
      { capability, err: parsed.error.message },
      "rerank model returned unparseable output; falling back to rule score",
    );
  } catch (error) {
    matchLogger.warn(
      { capability, err: error },
      "rerank model call failed; falling back to rule score",
    );
  }

  return { output: fallbackOutput(ruleScore, capability), llmInvoked: false };
}

function parseRerankResponse(response: {
  object?: unknown;
  text?: string;
  content?: string;
}) {
  const objectResult = MatchingOutputSchema.safeParse(response.object);
  if (objectResult.success) {
    return objectResult;
  }

  const text = extractResponseText(response);
  if (!text) {
    return objectResult;
  }

  try {
    const json = extractJsonObject(text);
    return MatchingOutputSchema.safeParse(JSON.parse(json));
  } catch {
    return objectResult;
  }
}

function extractResponseText(response: { text?: string; content?: string }) {
  if (typeof response.text === "string") return response.text.trim();
  if (typeof response.content === "string") return response.content.trim();
  return "";
}

function extractJsonObject(value: string) {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return value.slice(start, end + 1);
  }

  return value;
}

/** Deterministic fallback when the model is unavailable or unparseable. */
export function fallbackOutput(
  ruleScore: RuleScoreResult,
  capability: RerankCapability,
): MatchingOutput {
  const direction =
    capability === "job-rerank"
      ? ("candidate-to-job" as const)
      : ("job-to-candidate" as const);
  return {
    matchScore: ruleScore.score,
    confidence: 0.5,
    reasons: ruleScoreReasons(ruleScore),
    missingRequirements: [],
    riskFlags: [],
    recommendedAction: recommendActionFromScore(ruleScore.score, direction),
  };
}

/** Compute the rule score for a pair (helper used by the pipeline). */
export function computeRuleScore(
  candidate: CandidateMatchInput,
  job: JobMatchInput,
): RuleScoreResult {
  return scoreMatch(candidate, job);
}

function describeCandidate(candidate: CandidateMatchInput) {
  return [
    candidate.fullName ?? "Unknown candidate",
    candidate.headline,
    `Skills: ${candidate.skills.join(", ") || "none listed"}`,
    candidate.location ? `Location: ${candidate.location}` : null,
    candidate.workPreference ? `Work preference: ${candidate.workPreference}` : null,
    candidate.expectedSalary
      ? `Salary: ${candidate.expectedSalary.min ?? "?"}-${candidate.expectedSalary.max ?? "?"} ${candidate.expectedSalary.currency ?? ""}`.trim()
      : null,
  ]
    .filter(Boolean)
    .join("; ");
}

function describeJob(job: JobMatchInput) {
  return [
    `${job.title} at ${job.companyName}`,
    `Required skills: ${job.skillsRequired.join(", ") || "none"}`,
    `Level: ${job.experienceLevel}`,
    `Location: ${job.location}${job.remote ? " (remote)" : ""}`,
    `Salary: ${job.salaryRange}`,
    `Risk: ${job.riskLevel} (${job.riskScore})`,
  ].join("; ");
}
