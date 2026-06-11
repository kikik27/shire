"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin, Clock, DollarSign, Zap } from "lucide-react";
import { useShireStore, getRecruiterById } from "@/lib/store";
import { computeMatch, computeRisk, offerSafety, recommendStake } from "@/lib/ai";
import { PageHeader } from "@/components/shared/page-header";
import { RecruiterTrustCard } from "@/components/trust/recruiter-trust-card";
import { AiInsightCard } from "@/components/ai/ai-insight-card";
import { WarningPanel } from "@/components/trust/warning-panel";
import { StakeRecommendationCard } from "@/components/ai/stake-recommendation-card";
import { OfferSafetyPanel } from "@/components/ai/offer-safety-panel";
import { ApplyKitGenerator } from "@/components/ai/apply-kit-generator";
import { ApplyButton } from "@/components/applications/apply-button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatToken, relativeDeadline } from "@/lib/format";

const jobTypeLabel: Record<string, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  CONTRACT: "Contract",
  FREELANCE: "Freelance",
  INTERNSHIP: "Internship",
};

const expLabel: Record<string, string> = {
  INTERN: "Intern",
  JUNIOR: "Junior",
  MID: "Mid-level",
  SENIOR: "Senior",
  LEAD: "Lead",
};

export default function CandidateJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const job = useShireStore((s) => s.jobs.find((j) => j.id === id));
  const profile = useShireStore((s) => s.candidateProfile);
  const recruiterProfile = useShireStore((s) => s.recruiterProfile);

  if (!job) return notFound();

  const recruiter = getRecruiterById({ recruiterProfile }, job.recruiterId);
  const match = computeMatch(job, profile);
  const risk = computeRisk(job, recruiter);
  const stake = recommendStake(job, recruiter);
  const safety = offerSafety(job);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <Link
        href="/candidate/jobs"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to jobs
      </Link>

      <PageHeader title={job.title} description={job.companyName}>
        <ApplyButton job={job} />
      </PageHeader>

      <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <MapPin className="size-3.5" aria-hidden="true" />
          {job.remote ? "Remote" : job.location}
        </span>
        <span aria-hidden="true">·</span>
        <span>{jobTypeLabel[job.jobType]}</span>
        <span aria-hidden="true">·</span>
        <span>{expLabel[job.experienceLevel]}</span>
        {job.salaryRange && (
          <>
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-1">
              <DollarSign className="size-3.5" aria-hidden="true" />
              {job.salaryRange}
            </span>
          </>
        )}
        <span aria-hidden="true">·</span>
        <span className="flex items-center gap-1">
          <Clock className="size-3.5" aria-hidden="true" />
          {relativeDeadline(job.expiresAt)}
        </span>
        {job.stakeAmount > 0 && (
          <>
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-1 text-success">
              <Zap className="size-3.5" aria-hidden="true" />
              Staked {formatToken(job.stakeAmount, job.stakeToken)}
            </span>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {job.skillsRequired.map((skill) => (
          <Badge key={skill} variant="secondary">
            {skill}
          </Badge>
        ))}
      </div>

      <div className="prose prose-sm dark:prose-invert max-w-none rounded-2xl border border-border bg-card p-5">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
          {job.description}
        </p>
      </div>

      <Separator />

      <div className="grid gap-4 lg:grid-cols-2">
        {profile && <AiInsightCard match={match} />}
        <WarningPanel risk={risk} />
      </div>

      <StakeRecommendationCard rec={stake} />

      {safety.flags.length > 0 && <OfferSafetyPanel safety={safety} />}

      {recruiter && <RecruiterTrustCard recruiter={recruiter} />}

      <ApplyKitGenerator job={job} />
    </div>
  );
}
