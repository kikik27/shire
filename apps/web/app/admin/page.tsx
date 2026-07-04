"use client";

import { AlertTriangle, Briefcase, RotateCw, Scale, Zap } from "lucide-react";
import { useAdminOverview } from "@/lib/hooks/use-admin";
import { PageHeader } from "@/components/shared/page-header";
import { StatTile } from "@/components/shared/stat-tile";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

export default function AdminPage() {
  const { data, isLoading, isError, isFetching, refetch } =
    useAdminOverview();

  return (
    <div className="space-y-8 p-4 sm:p-6">
      <PageHeader
        title="Admin overview"
        description="Platform health: jobs, escrow, and disputes."
      />

      {isLoading ? (
        <EmptyState
          icon={Scale}
          title="Loading admin overview"
          description="Fetching persisted platform operations."
        />
      ) : isError || !data ? (
        <EmptyState
          icon={Scale}
          title="Admin overview unavailable"
          description="Your account may not have admin access, or the request failed."
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
      ) : (
        <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Total jobs" value={String(data.totalJobs)} icon={Briefcase} />
        <StatTile
          label="Active stakes"
          value={String(data.activeStakes)}
          icon={Zap}
        />
        <StatTile
          label="Open disputes"
          value={String(data.openDisputes)}
          icon={Scale}
        />
        <StatTile
          label="Flagged / high-risk"
          value={String(data.flaggedJobs)}
          icon={AlertTriangle}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Job status breakdown
          </p>
          <ul className="mt-3 space-y-2">
            {(["ACTIVE", "DRAFT", "CLOSED", "FLAGGED", "EXPIRED"] as const).map((status) => {
              const count = data.jobStatuses[status] ?? 0;
              return (
                <li key={status} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{status.charAt(0) + status.slice(1).toLowerCase()}</span>
                  <span className="font-mono tabular-nums">{count}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Stake status breakdown
          </p>
          <ul className="mt-3 space-y-2">
            {([
              { label: "Locked", status: "LOCKED" },
              { label: "Refunded", status: "REFUNDED" },
              { label: "Slashed", status: "SLASHED" },
              { label: "Released", status: "RELEASED" },
            ]).map(({ label, status }) => {
              const count = data.stakeStatuses[status] ?? 0;
              return (
                <li key={label} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-mono tabular-nums">{count}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Dispute breakdown
          </p>
          <ul className="mt-3 space-y-2">
            {(["OPEN", "UNDER_REVIEW", "RESOLVED", "REJECTED"] as const).map((status) => {
              const count = data.disputeStatuses[status] ?? 0;
              return (
                <li key={status} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {status.replace("_", " ").charAt(0) +
                      status.replace("_", " ").slice(1).toLowerCase()}
                  </span>
                  <span className="font-mono tabular-nums">{count}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
        </>
      )}
    </div>
  );
}
