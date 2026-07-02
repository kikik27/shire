"use client";

import Link from "next/link";
import { RotateCw, Zap } from "lucide-react";
import { useMyApplications } from "@/lib/hooks/use-applications";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/format";

export default function CandidateStakesPage() {
  const {
    data: applications = [],
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useMyApplications();
  const stakedApplications = applications.filter(
    (application) =>
      application.stakeAmount !== undefined || application.stakeTx,
  );

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="My stakes"
        description="Escrow history for your applications."
      />

      {isLoading ? (
        <EmptyState
          icon={Zap}
          title="Loading stake history"
          description="Fetching stake records from your applications."
        />
      ) : isError ? (
        <EmptyState
          icon={Zap}
          title="Stake history unavailable"
          description="We could not load your stake history. Retry the request or check your connection."
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
      ) : stakedApplications.length === 0 ? (
        <EmptyState
        icon={Zap}
        title="No stake history"
        description="Escrow records from your applications will appear here when stake activity is available."
        action={
          <Button asChild size="sm">
            <Link href="/candidate/applications">View applications</Link>
          </Button>
        }
        />
      ) : (
        <div className="space-y-2">
          {stakedApplications.map((application) => (
            <Link
              key={application.id}
              href={`/candidate/jobs/${application.jobId}`}
              className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4 transition-[box-shadow] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="min-w-0">
                <p className="font-medium">
                  Application {application.id.slice(0, 8)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Recorded {timeAgo(application.appliedAt)}
                </p>
                {application.stakeTx && (
                  <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                    {application.stakeTx}
                  </p>
                )}
              </div>
              <span className="shrink-0 font-mono text-sm font-semibold tabular-nums">
                {application.stakeAmount ?? 0}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
