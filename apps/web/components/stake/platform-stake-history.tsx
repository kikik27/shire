import type { ReactNode } from "react";
import { RotateCw, Zap } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import {
  platformStakeTypeLabel,
  StakeStatusBadge,
} from "@/components/stake/stake-status-badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatToken } from "@/lib/format";
import type { PlatformStake } from "@/lib/types";

export function PlatformStakeHistory({
  stakes,
  isLoading,
  error,
  isFetching,
  onRetry,
  emptyAction,
}: {
  stakes: PlatformStake[];
  isLoading: boolean;
  error: unknown;
  isFetching: boolean;
  onRetry: () => void;
  emptyAction?: ReactNode;
}) {
  if (isLoading) {
    return (
      <EmptyState
        icon={Zap}
        title="Loading platform escrow"
        description="Fetching your persisted stake records."
      />
    );
  }
  if (error) {
    return (
      <EmptyState
        icon={Zap}
        title="Platform escrow unavailable"
        description="We could not load your stake records."
        action={
          <Button
            size="sm"
            variant="outline"
            onClick={onRetry}
            disabled={isFetching}
          >
            <RotateCw className="size-4" aria-hidden="true" />
            Retry
          </Button>
        }
      />
    );
  }
  if (stakes.length === 0) {
    return (
      <EmptyState
        icon={Zap}
        title="No platform escrow history"
        description="Stake records will appear here after escrow is created."
        action={emptyAction}
      />
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <ul className="divide-y divide-border">
        {stakes.map((stake) => (
          <li
            key={stake.id}
            className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium">{platformStakeTypeLabel[stake.type]}</p>
              <p className="text-xs text-muted-foreground">
                Created {formatDate(stake.createdAt)}
              </p>
              {stake.reason && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {stake.reason}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm font-semibold tabular-nums">
                {formatToken(stake.amount, stake.token)}
              </span>
              <StakeStatusBadge status={stake.status} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
