"use client";

import { AlertTriangle, Briefcase, Scale, Zap } from "lucide-react";
import { useShireStore } from "@/lib/store";
import { StakeStatus } from "@/lib/types";
import { PageHeader } from "@/components/shared/page-header";
import { StatTile } from "@/components/shared/stat-tile";

export default function AdminPage() {
  const jobs = useShireStore((s) => s.jobs);
  const stakes = useShireStore((s) => s.stakes);
  const disputes = useShireStore((s) => s.disputes);

  const activeStakes = stakes.filter((s) => s.status === StakeStatus.Locked);
  const openDisputes = disputes.filter((d) => d.status === "OPEN" || d.status === "UNDER_REVIEW");
  const flaggedJobs = jobs.filter((j) => j.status === "FLAGGED" || j.riskLevel === "HIGH");

  return (
    <div className="space-y-8 p-4 sm:p-6">
      <PageHeader
        title="Admin overview"
        description="Platform health — jobs, stakes, and disputes."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Total jobs" value={String(jobs.length)} icon={Briefcase} />
        <StatTile
          label="Active stakes"
          value={String(activeStakes.length)}
          icon={Zap}
        />
        <StatTile
          label="Open disputes"
          value={String(openDisputes.length)}
          icon={Scale}
        />
        <StatTile
          label="Flagged / high-risk"
          value={String(flaggedJobs.length)}
          icon={AlertTriangle}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Job status breakdown
          </p>
          <ul className="mt-3 space-y-2">
            {(["ACTIVE", "DRAFT", "CLOSED", "FLAGGED", "EXPIRED"] as const).map((status) => {
              const count = jobs.filter((j) => j.status === status).length;
              return (
                <li key={status} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{status.charAt(0) + status.slice(1).toLowerCase()}</span>
                  <span className="font-mono tabular-nums">{count}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Stake status breakdown
          </p>
          <ul className="mt-3 space-y-2">
            {([
              { label: "Locked", status: StakeStatus.Locked },
              { label: "Refunded", status: StakeStatus.Refunded },
              { label: "Slashed", status: StakeStatus.Slashed },
              { label: "Released", status: StakeStatus.Released },
            ]).map(({ label, status }) => {
              const count = stakes.filter((s) => s.status === status).length;
              return (
                <li key={label} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-mono tabular-nums">{count}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Dispute breakdown
          </p>
          <ul className="mt-3 space-y-2">
            {(["OPEN", "UNDER_REVIEW", "RESOLVED", "REJECTED"] as const).map((status) => {
              const count = disputes.filter((d) => d.status === status).length;
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
    </div>
  );
}
