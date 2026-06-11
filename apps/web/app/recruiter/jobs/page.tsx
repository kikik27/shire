"use client";

import Link from "next/link";
import { Briefcase, Plus } from "lucide-react";
import { useRecruiterJobs } from "@/lib/selectors";
import { useShireStore } from "@/lib/store";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";
import { RiskScoreBadge } from "@/components/trust/scores";
import { EmptyState } from "@/components/shared/empty-state";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatToken, initials, timeAgo } from "@/lib/format";

export default function RecruiterJobsPage() {
  const jobs = useRecruiterJobs();
  const applications = useShireStore((s) => s.applications);

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

      {jobs.length === 0 ? (
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
          {jobs.map((job) => {
            const appCount = applications.filter((a) => a.jobId === job.id).length;
            return (
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
                    {job.remote ? "Remote" : job.location} · posted {timeAgo(job.createdAt)} ·{" "}
                    <span className="font-mono tabular-nums">{appCount}</span> applicant
                    {appCount !== 1 ? "s" : ""}
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
            );
          })}
        </div>
      )}
    </div>
  );
}
