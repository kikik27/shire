import { ExternalLink } from "lucide-react";
import type { Stake } from "@/lib/types";
import { StakeStatusBadge, stakeTypeLabel } from "@/components/stake/stake-status-badge";
import { formatToken, formatDate, truncateAddress } from "@/lib/format";

export function StakeHistoryCard({ stake, jobTitle }: { stake: Stake; jobTitle?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">
            {stakeTypeLabel[stake.stakeType] ?? "Stake"} stake
          </p>
          <StakeStatusBadge status={stake.status} />
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {jobTitle ? `${jobTitle} · ` : ""}
          {formatDate(stake.createdAt)}
        </p>
        {stake.reason && (
          <p className="mt-1 text-xs text-destructive">Reason: {stake.reason}</p>
        )}
      </div>
      <div className="text-right">
        <p className="font-mono text-sm font-semibold tabular-nums">
          {formatToken(stake.amount, stake.token)}
        </p>
        <a
          href={`https://alfajores.celoscan.io/tx/${stake.txHash}`}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {truncateAddress(stake.txHash, 3)}
          <ExternalLink className="size-3" aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}
