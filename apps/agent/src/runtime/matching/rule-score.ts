import type { CandidateMatchInput, JobMatchInput } from "./types";

/**
 * Deterministic rule-score engine. Implements the documented weights from
 * .agent/context/agent/matching-pipeline.md:
 *
 *   Skill match:        40%
 *   Experience match:   20%
 *   Location/work pref: 15%
 *   Salary fit:         10%
 *   Portfolio/history:  10%
 *   Risk adjustment:     5%
 *
 * No LLM is involved. This runs BEFORE the rerank model so that only the
 * reduced, score-passing set is sent to the capability model (retrieval-first).
 */

export const RULE_WEIGHTS = {
  skill: 0.4,
  experience: 0.2,
  location: 0.15,
  salary: 0.1,
  portfolio: 0.1,
  risk: 0.05,
} as const;

export type RuleScoreComponent = {
  weight: number;
  /** Raw 0-1 normalized score for this component before weighting. */
  raw: number;
  /** Weighted contribution (raw * weight * 100). */
  points: number;
  reasons: string[];
};

export type RuleScoreResult = {
  score: number;
  components: Record<
    "skill" | "experience" | "location" | "salary" | "portfolio" | "risk",
    RuleScoreComponent
  >;
};

const EXPERIENCE_LEVELS: Record<string, number> = {
  ENTRY: 1,
  JUNIOR: 2,
  MID: 3,
  INTERMEDIATE: 3,
  SENIOR: 4,
  LEAD: 5,
  STAFF: 5,
  PRINCIPAL: 5,
};

function normalizeSkill(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9+#.-]+/g, "");
}

function skillOverlap(candidateSkills: string[], requiredSkills: string[]) {
  const candidate = new Set(
    candidateSkills.map(normalizeSkill).filter(Boolean),
  );
  const required = requiredSkills.map(normalizeSkill).filter(Boolean);
  if (required.length === 0) {
    return { matched: [] as string[], ratio: 0 };
  }
  const matched = required.filter((skill) => candidate.has(skill));
  return { matched, ratio: matched.length / required.length };
}

function parseSalaryRange(range: string): { min?: number; max?: number } {
  // "120000-160000", "$120k-$160k", "120000". Extract all numbers in k/raw.
  const matches = range.toLowerCase().match(/(\d+(\.\d+)?)(k)?/g) ?? [];
  const values = matches.map((match) => {
    const k = match.endsWith("k");
    const numeric = Number(match.replace(/k$/, ""));
    return k ? numeric * 1000 : numeric;
  });
  const [min, max] = values;
  return { min, max };
}

function salaryFit(
  candidateSalary: CandidateMatchInput["expectedSalary"],
  jobRange: string,
): { raw: number; reasons: string[] } {
  const job = parseSalaryRange(jobRange);
  const candMin = candidateSalary?.min;
  const candMax = candidateSalary?.max;

  if (candMin === undefined && candMax === undefined) {
    // No candidate expectation: neutral, slight positive (don't penalize
    // candidates who haven't stated a range).
    return { raw: 0.6, reasons: [] };
  }
  if (job.min === undefined && job.max === undefined) {
    return { raw: 0.6, reasons: [] };
  }

  const overlap =
    candMin !== undefined && candMax !== undefined && job.max !== undefined
      ? Math.min(candMax, job.max) - Math.max(candMin, job.min ?? candMin)
      : undefined;

  if (overlap !== undefined && overlap >= 0) {
    return { raw: 1, reasons: [] };
  }
  // Candidate expects more than the job offers (or vice versa): partial credit.
  return { raw: 0.3, reasons: ["candidate salary expectation may not align"] };
}

function locationFit(
  candidate: CandidateMatchInput,
  job: JobMatchInput,
): { raw: number; reasons: string[] } {
  if (job.remote) {
    return { raw: 0.9, reasons: ["job is remote"] };
  }
  const candidateLocation = candidate.location?.toLowerCase();
  const jobLocation = job.location.toLowerCase();
  if (!candidateLocation) {
    return { raw: 0.5, reasons: [] };
  }
  if (candidateLocation === jobLocation) {
    return { raw: 1, reasons: ["location match"] };
  }
  if (
    candidateLocation.includes(jobLocation) ||
    jobLocation.includes(candidateLocation)
  ) {
    return { raw: 0.7, reasons: ["location region match"] };
  }
  return { raw: 0.2, reasons: ["location mismatch"] };
}

function portfolioFit(candidate: CandidateMatchInput): {
  raw: number;
  reasons: string[];
} {
  const signals = [
    candidate.portfolioUrl,
    candidate.githubUrl,
    candidate.linkedinUrl,
  ].filter(Boolean);
  if (signals.length === 0) {
    return { raw: 0.2, reasons: [] };
  }
  // Up to 3 signals; each adds ~0.33, capped at 1.
  return { raw: Math.min(1, 0.34 + signals.length * 0.33), reasons: [] };
}

function riskAdjustment(job: JobMatchInput): {
  raw: number;
  reasons: string[];
} {
  // Lower riskScore and a non-risky riskLevel contribute positively.
  const level = job.riskLevel.toUpperCase();
  const levelFactor =
    level === "UNKNOWN" || level === "LOW" || level === "NONE"
      ? 0.9
      : level === "MEDIUM"
        ? 0.6
        : 0.3;
  const scoreFactor = Math.max(0, 1 - job.riskScore / 100);
  const raw = levelFactor * 0.5 + scoreFactor * 0.5;
  const reasons: string[] = [];
  if (level === "HIGH" || level === "CRITICAL") {
    reasons.push(`job risk level ${level.toLowerCase()} reduces fit`);
  }
  return { raw, reasons };
}

function experienceFit(
  candidate: CandidateMatchInput,
  job: JobMatchInput,
): { raw: number; reasons: string[] } {
  const requiredLevel = EXPERIENCE_LEVELS[job.experienceLevel.toUpperCase()] ?? 3;

  // If the candidate stated years, map to an approximate level.
  let candidateLevel: number | undefined;
  if (candidate.yearsExperience !== undefined) {
    candidateLevel =
      candidate.yearsExperience >= 8
        ? 5
        : candidate.yearsExperience >= 5
          ? 4
          : candidate.yearsExperience >= 2
            ? 3
            : 2;
  }
  // Preferred roles can hint seniority via keywords.
  const roleText = candidate.preferredRoles.join(" ").toLowerCase();
  if (candidateLevel === undefined) {
    if (/(senior|lead|staff|principal)/.test(roleText)) candidateLevel = 4;
    else if (/(junior|entry|intern)/.test(roleText)) candidateLevel = 2;
  }

  if (candidateLevel === undefined) {
    return { raw: 0.5, reasons: [] };
  }

  if (candidateLevel >= requiredLevel) {
    return { raw: 1, reasons: [] };
  }
  const gap = requiredLevel - candidateLevel;
  // One level short is a near-miss; two+ is a real gap.
  return {
    raw: gap === 1 ? 0.6 : 0.25,
    reasons:
      gap > 1
        ? [`candidate may be below the ${job.experienceLevel.toLowerCase()} level`]
        : [],
  };
}

function buildComponent(
  weight: number,
  raw: number,
  reasons: string[],
): RuleScoreComponent {
  return { weight, raw, points: raw * weight * 100, reasons };
}

export function scoreMatch(
  candidate: CandidateMatchInput,
  job: JobMatchInput,
): RuleScoreResult {
  const skill = skillOverlap(candidate.skills, job.skillsRequired);
  const skillReasons =
    skill.matched.length > 0
      ? [`${skill.matched.length} required skill${skill.matched.length > 1 ? "s" : ""} matched`]
      : ["no required skills matched"];

  const experience = experienceFit(candidate, job);
  const location = locationFit(candidate, job);
  const salary = salaryFit(candidate.expectedSalary, job.salaryRange);
  const portfolio = portfolioFit(candidate);
  const risk = riskAdjustment(job);

  const components = {
    skill: buildComponent(RULE_WEIGHTS.skill, skill.ratio, skillReasons),
    experience: buildComponent(
      RULE_WEIGHTS.experience,
      experience.raw,
      experience.reasons,
    ),
    location: buildComponent(RULE_WEIGHTS.location, location.raw, location.reasons),
    salary: buildComponent(RULE_WEIGHTS.salary, salary.raw, salary.reasons),
    portfolio: buildComponent(
      RULE_WEIGHTS.portfolio,
      portfolio.raw,
      portfolio.reasons,
    ),
    risk: buildComponent(RULE_WEIGHTS.risk, risk.raw, risk.reasons),
  };

  const score = Math.round(
    Object.values(components).reduce((sum, component) => sum + component.points, 0),
  );

  return { score: Math.min(100, Math.max(0, score)), components };
}

/**
 * Flatten a rule-score result into the human-readable reasons array used by
 * the final MatchingOutput.
 */
export function ruleScoreReasons(result: RuleScoreResult): string[] {
  return Object.values(result.components)
    .flatMap((component) => component.reasons)
    .filter(Boolean);
}
