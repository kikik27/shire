/**
 * Deterministic, rule-based stand-ins for the Shire AI agent service.
 * Same output shape as the documented agents — swap these for real `/ai/*` calls later.
 * No randomness, so SSR and client renders agree.
 */
import type {
  ApplyKit,
  CandidateProfile,
  ExperienceLevel,
  Job,
  MatchResult,
  OfferSafety,
  RecruiterProfile,
  RiskResult,
  StakeRecommendation,
} from "@/lib/types";

const EXP_ORDER: ExperienceLevel[] = ["INTERN", "JUNIOR", "MID", "SENIOR", "LEAD"];

const SCAM_SIGNALS: { kw: string; flag: string }[] = [
  { kw: "seed phrase", flag: "Asks for a seed phrase" },
  { kw: "private key", flag: "Requests a private key" },
  { kw: "deposit", flag: "Requires an upfront deposit" },
  { kw: "registration fee", flag: "Charges a registration fee" },
  { kw: "telegram", flag: "Pushes the conversation off-platform" },
  { kw: "whatsapp", flag: "Pushes the conversation off-platform" },
  { kw: "urgent", flag: "Uses urgency pressure" },
  { kw: "guaranteed", flag: "Promises guaranteed income" },
  { kw: "install", flag: "Asks you to install unknown software" },
];

function clamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function norm(s: string) {
  return s.trim().toLowerCase();
}

export function skillOverlap(job: Job, profile?: CandidateProfile | null) {
  const have = new Set((profile?.skills ?? []).map(norm));
  const need = job.skillsRequired.map(norm);
  const matched = need.filter((s) => have.has(s));
  const missing = job.skillsRequired.filter((s) => !have.has(norm(s)));
  return { matched, missing, ratio: need.length ? matched.length / need.length : 0 };
}

export function computeMatch(job: Job, profile?: CandidateProfile | null): MatchResult {
  if (!profile) {
    return {
      matchScore: 0,
      recommendation: "Weak Match",
      reason: "Complete your candidate profile to see how well you fit this role.",
      missingSkills: job.skillsRequired,
      applyAdvice: "Add your skills and target roles first.",
    };
  }

  const { missing, ratio } = skillOverlap(job, profile);

  const roleHit = profile.roleTargets.some((r) =>
    job.title.toLowerCase().includes(norm(r).split(" ")[0]),
  );
  const expDelta = Math.abs(
    EXP_ORDER.indexOf(profile.experienceLevel) - EXP_ORDER.indexOf(job.experienceLevel),
  );
  const portfolio = profile.portfolioUrl || profile.githubUrl ? 1 : 0;

  const score = clamp(
    ratio * 55 + (roleHit ? 22 : 6) + (expDelta <= 1 ? 13 : 4) + portfolio * 10,
  );

  const recommendation: MatchResult["recommendation"] =
    score >= 80
      ? "Strong Match"
      : score >= 60
        ? "Good Match"
        : score >= 40
          ? "Partial Match"
          : "Weak Match";

  const reason =
    score >= 60
      ? `Your skills cover ${Math.round(ratio * 100)}% of the requirements${roleHit ? " and the role matches your target" : ""}.`
      : `You cover ${Math.round(ratio * 100)}% of the requirements — closing a few gaps will lift your match.`;

  return {
    matchScore: score,
    recommendation,
    reason,
    missingSkills: missing,
    applyAdvice: missing.length
      ? `Highlight your strongest matching skills and address ${missing.slice(0, 2).join(" and ")}.`
      : "Lead with your portfolio and most relevant project.",
  };
}

export function computeRisk(job: Job, recruiter?: RecruiterProfile | null): RiskResult {
  const text = `${job.title} ${job.description}`.toLowerCase();
  const flags: string[] = [];

  for (const s of SCAM_SIGNALS) {
    if (text.includes(s.kw) && !flags.includes(s.flag)) flags.push(s.flag);
  }
  if (recruiter && recruiter.verificationStatus !== "VERIFIED") {
    flags.push("Recruiter is not verified yet");
  }
  if (recruiter && !recruiter.companyWebsite) flags.push("No company website provided");
  if (recruiter && recruiter.disputeCount > 0) flags.push("Recruiter has past disputes");
  if (job.description.length < 120) flags.push("Job description is unusually short");
  if (job.stakeAmount <= 0) flags.push("Recruiter has not staked");

  const score = clamp(flags.length * 17 + (recruiter?.verificationStatus === "VERIFIED" ? -8 : 6));
  const riskLevel: RiskResult["riskLevel"] =
    score >= 66 ? "HIGH" : score >= 33 ? "MEDIUM" : "LOW";

  return {
    riskLevel,
    riskScore: score,
    flags,
    recommendation:
      riskLevel === "HIGH"
        ? "Proceed only after admin review. Never share a seed phrase, private key, or pay anything off-platform."
        : riskLevel === "MEDIUM"
          ? "Proceed carefully. Keep all communication and payment inside Shire."
          : "Looks legitimate. Standard caution applies — keep everything on-platform.",
    confidence: 0.6 + Math.min(0.3, flags.length * 0.05),
  };
}

export function recommendStake(
  job: Pick<Job, "riskLevel">,
  recruiter?: RecruiterProfile | null,
): StakeRecommendation {
  const verified = recruiter?.verificationStatus === "VERIFIED";
  const newRecruiter = (recruiter?.completedHires ?? 0) === 0;

  if (job.riskLevel === "HIGH") {
    return {
      recommendedRecruiterStake: "20 cUSD",
      candidateStakeRequired: false,
      stakeReason: "High-risk signals detected. A higher stake and admin review are advised.",
      refundPolicy: "Held until admin review clears the listing.",
    };
  }
  if (verified && !newRecruiter) {
    return {
      recommendedRecruiterStake: "3–5 cUSD",
      candidateStakeRequired: false,
      stakeReason: "Verified company with hiring history — a light stake signals good faith.",
      refundPolicy: "Refundable when the job closes without a valid dispute.",
    };
  }
  return {
    recommendedRecruiterStake: "10–20 cUSD",
    candidateStakeRequired: false,
    stakeReason: "New recruiter or unverified company — a higher stake builds candidate trust.",
    refundPolicy: "Refundable when the job closes without a valid dispute.",
  };
}

export function offerSafety(job: Job): OfferSafety {
  const flags: string[] = [];
  if (job.salaryRange.includes("?") || /negotiable/i.test(job.salaryRange))
    flags.push("Payment amount is not clearly defined");
  if (job.description.length < 200) flags.push("Scope of work is too general");
  if (/deposit|fee|upfront/i.test(job.description))
    flags.push("Mentions an upfront cost — verify before accepting");

  const level = flags.length >= 2 ? "MEDIUM" : flags.length === 1 ? "MEDIUM" : "LOW";
  return {
    offerSafetyLevel: level,
    flags,
    recommendation: flags.length
      ? "Ask for a clear payment schedule and a defined scope before accepting."
      : "Terms look clear. Confirm start date and payment schedule in writing.",
  };
}

export function generateApplyKit(job: Job, profile?: CandidateProfile | null): ApplyKit {
  const name = profile?.displayName || "there";
  const top = (profile?.skills ?? ["my background"]).slice(0, 3).join(", ");
  return {
    shortIntro: `Hi, I'm ${name} — a ${profile?.experienceLevel?.toLowerCase() ?? "motivated"} candidate focused on ${profile?.roleTargets?.[0] ?? job.title}.`,
    coverLetter: `Dear ${job.companyName} team,\n\nI'm excited to apply for the ${job.title} role. My experience with ${top} maps directly to what you're looking for, and I'm drawn to building with a team that takes hiring integrity seriously.\n\nI'd welcome the chance to walk through a recent project and how I'd contribute in the first 30 days.\n\nBest,\n${name}`,
    recruiterDM: `Hi — I just applied for the ${job.title} role at ${job.companyName}. I bring strong ${top} experience and I'm staked and serious about this one. Happy to share a quick portfolio walkthrough whenever works for you.`,
    followUp: `Hi again — following up on my application for ${job.title}. Still very interested and available for a short call this week. Thank you for considering me!`,
  };
}
