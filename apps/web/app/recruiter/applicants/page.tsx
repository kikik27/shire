"use client";

import Link from "next/link";
import { RotateCw, Users } from "lucide-react";
import { useRecruiterApplications } from "@/lib/hooks/use-applications";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { ApplicationStatusBadge } from "@/components/applications/application-status-badge";
import { MatchScoreBadge } from "@/components/trust/scores";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials, timeAgo } from "@/lib/format";

export default function RecruiterApplicantsPage() {
  const {
    data: applications = [],
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useRecruiterApplications();

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="All applicants"
        description="Review candidates across your jobs."
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
      ) : applications.length === 0 ? (
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
          {applications.map((application) => {
            const displayName =
              application.candidate?.displayName ??
              `Candidate ${application.candidateId.slice(0, 8)}`;
            return (
            <Link
              key={application.id}
              href={`/recruiter/jobs/${application.jobId}`}
              className="flex flex-col items-start gap-3 rounded-lg border border-border bg-card p-4 transition-[box-shadow] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:items-center"
            >
              <Avatar className="size-10 shrink-0">
                <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                  {initials(displayName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{displayName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {application.job?.title ?? "Owned job"} - applied{" "}
                  {timeAgo(application.appliedAt)}
                </p>
                {application.candidate?.headline && (
                  <p className="truncate text-xs text-muted-foreground">
                    {application.candidate.headline}
                  </p>
                )}
              </div>
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                <MatchScoreBadge score={application.matchScore} />
                <ApplicationStatusBadge status={application.status} />
              </div>
            </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
