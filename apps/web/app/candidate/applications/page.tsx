"use client";

import { FileText, RotateCw } from "lucide-react";
import { useMyApplications } from "@/lib/hooks/use-applications";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ApplicationStatusBadge } from "@/components/applications/application-status-badge";
import { MatchScoreBadge } from "@/components/trust/scores";
import { timeAgo } from "@/lib/format";

export default function CandidateApplicationsPage() {
  const {
    data: applications = [],
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useMyApplications();

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="My applications"
        description={`${applications.length} total`}
      />

      {isLoading ? (
        <EmptyState
          icon={FileText}
          title="Loading applications"
          description="Fetching your saved applications from the database."
        />
      ) : isError ? (
        <EmptyState
          icon={FileText}
          title="Applications unavailable"
          description="We could not load your applications. Retry the request or check your connection."
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
          icon={FileText}
          title="No applications yet"
          description="Apply to a job to see your tracker here."
          action={
            <Button asChild size="sm">
              <Link href="/candidate/jobs">Browse jobs</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {applications.map((app) => (
            <div
              key={app.id}
              className="rounded-2xl border border-border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/candidate/jobs/${app.jobId}`}
                    className="font-medium hover:underline"
                  >
                    Application {app.id.slice(0, 8)}
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Job {app.jobId.slice(0, 8)} - applied {timeAgo(app.appliedAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <ApplicationStatusBadge status={app.status} />
                  <MatchScoreBadge score={app.matchScore} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
