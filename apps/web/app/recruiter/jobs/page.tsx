"use client";

import Link from "next/link";
import { Briefcase, Plus, RotateCw } from "lucide-react";
import { useRecruiterApiJobs } from "@/lib/hooks/use-jobs";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";
import { RiskScoreBadge } from "@/components/trust/scores";
import { EmptyState } from "@/components/shared/empty-state";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatToken, initials, timeAgo } from "@/lib/format";

export default function RecruiterJobsPage() {
  const {
    data: jobs = [],
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useRecruiterApiJobs();

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader title="My jobs" description={`${jobs.length} total`}>
        <Button asChild size="sm">
          <Link href="/recruiter/jobs/new">
            <Plus className="size-4" />
            Post a job
          </Link>
        </Button>
      </PageHeader>

      {isLoading ? (
        <EmptyState
          icon={Briefcase}
          title="Loading jobs"
          description="Fetching your saved job posts from the database."
        />
      ) : isError ? (
        <EmptyState
          icon={Briefcase}
          title="Jobs unavailable"
          description="We could not load your jobs. Retry the request or check your connection."
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
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No jobs yet"
          description="Post your first role to start receiving staked applications."
          action={
            <Button asChild size="sm">
              <Link href="/recruiter/jobs/new">Post a job</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {jobs.map((job) => (
            <Link
              key={job.id}
              href={`/recruiter/jobs/${job.id}`}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-[box-shadow] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Avatar className="size-10">
                <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                  {initials(job.companyName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{job.title}</p>
                <p className="text-xs text-muted-foreground">
                  {job.remote ? "Remote" : job.location} - posted {timeAgo(job.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <RiskScoreBadge level={job.riskLevel} />
                <JobStatusBadge status={job.status} />
                <span className="hidden font-mono text-xs tabular-nums text-muted-foreground sm:block">
                  {formatToken(job.stakeAmount, job.stakeToken)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
