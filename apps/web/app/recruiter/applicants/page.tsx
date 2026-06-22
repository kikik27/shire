"use client";

import Link from "next/link";
import { Briefcase, RotateCw, Users } from "lucide-react";
import { useRecruiterApiJobs } from "@/lib/hooks/use-jobs";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials, timeAgo } from "@/lib/format";

export default function RecruiterApplicantsPage() {
  const {
    data: jobs = [],
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useRecruiterApiJobs();

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="All applicants"
        description="Review applicants from each API-backed job detail."
      />

      {isLoading ? (
        <EmptyState
          icon={Users}
          title="Loading applicant sources"
          description="Fetching your jobs from the database."
        />
      ) : isError ? (
        <EmptyState
          icon={Users}
          title="Applicants unavailable"
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
          icon={Users}
          title="No applicants yet"
          description="Post and stake a job to start receiving applications."
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
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-[box-shadow] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Avatar className="size-10">
                <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                  {initials(job.companyName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{job.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  Open applicant review - posted {timeAgo(job.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <JobStatusBadge status={job.status} />
                <Briefcase className="size-4 text-muted-foreground" aria-hidden="true" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
