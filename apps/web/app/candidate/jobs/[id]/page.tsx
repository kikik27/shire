"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Briefcase, Clock, DollarSign, MapPin, RotateCw, Zap } from "lucide-react";
import { useCandidateJob } from "@/lib/hooks/use-candidate-dashboard";
import { PageHeader } from "@/components/shared/page-header";
import { AiInsightCard } from "@/components/ai/ai-insight-card";
import { StakeRecommendationCard } from "@/components/ai/stake-recommendation-card";
import { ApplyButton } from "@/components/applications/apply-button";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  const {
    data,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useCandidateJob(id);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
        <p className="text-sm text-muted-foreground">Loading job...</p>
      </div>
    );
  }
  if (isError) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
        <Link
          href="/candidate/jobs"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to jobs
        </Link>
        <EmptyState
          icon={Briefcase}
          title="Job unavailable"
          description="We could not load this job from the API. Retry the request or check your connection."
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => void refetch()}
              disabled={isFetching}
            >
              <RotateCw className="size-4" aria-hidden="true" />
              Retry
            </Button>
          }
        />
      </div>
    );
  }
  if (!data) return notFound();
  const { job, match } = data;

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
        <span aria-hidden="true">/</span>
        <span>{jobTypeLabel[job.jobType]}</span>
        <span aria-hidden="true">/</span>
        <span>{expLabel[job.experienceLevel]}</span>
        {job.salaryRange && (
          <>
            <span aria-hidden="true">/</span>
            <span className="flex items-center gap-1">
              <DollarSign className="size-3.5" aria-hidden="true" />
              {job.salaryRange}
            </span>
          </>
        )}
        <span aria-hidden="true">/</span>
        <span className="flex items-center gap-1">
          <Clock className="size-3.5" aria-hidden="true" />
          {relativeDeadline(job.expiresAt)}
        </span>
        {job.stakeAmount > 0 && (
          <>
            <span aria-hidden="true">/</span>
            <span className="flex items-center gap-1 text-success">
              <Zap className="size-3.5" aria-hidden="true" />
              Staked {formatToken(job.stakeAmount, job.stakeToken)}
            </span>
          </>
        )}
        <span aria-hidden="true">/</span>
        <span>{job.riskLevel.toLowerCase()} risk</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {job.skillsRequired.map((skill) => (
          <Badge key={skill} variant="secondary">
            {skill}
          </Badge>
        ))}
      </div>

      <div className="prose prose-sm dark:prose-invert max-w-none rounded-lg border border-border bg-card p-5">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
          {job.description}
        </p>
      </div>

      <Separator />

      {match ? (
        <AiInsightCard match={match} />
      ) : (
        <p className="text-sm text-muted-foreground">
          A match evaluation is not available for this role yet.
        </p>
      )}

      <StakeRecommendationCard
        recruiterStake={job.stakeAmount}
        candidateStakeRequired={job.candidateStakeRequired}
        candidateStake={job.candidateStakeAmount}
        token={job.stakeToken}
      />
    </div>
  );
}
