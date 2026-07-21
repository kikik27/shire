"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Loader2 } from "lucide-react";

import {
  getApplicationOnchain,
  stellarExpertTxUrl,
  stroopsToXlm,
  type OnchainApplicationStatus,
} from "@/lib/stellar/escrow";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<OnchainApplicationStatus, string> = {
  Pending: "Pending",
  ApplicantStaked: "Staked — awaiting company",
  CompanyStaked: "Both staked",
  Completed: "Completed — released",
  Expired: "Expired — refunded",
  Disputed: "Disputed",
  Resolved: "Resolved",
  Unknown: "Status unavailable",
};

const STATUS_TONE: Record<OnchainApplicationStatus, string> = {
  Pending: "bg-muted text-muted-foreground",
  ApplicantStaked: "bg-warning/15 text-warning-foreground",
  CompanyStaked: "bg-primary/15 text-primary",
  Completed: "bg-success/15 text-success",
  Expired: "bg-muted text-muted-foreground",
  Disputed: "bg-destructive/15 text-destructive",
  Resolved: "bg-success/15 text-success",
  Unknown: "bg-muted text-muted-foreground",
};

const TERMINAL_STATUSES: OnchainApplicationStatus[] = ["Completed", "Expired", "Resolved"];

/**
 * Live status for a candidate's onchain stake — reads directly from the
 * deployed ShireEscrow contract (no backend indexer) and polls while the
 * escrow is still active. Renders nothing if the application was never
 * staked onchain (pre-integration applications, or non-native stake tokens).
 */
export function OnchainStakeStatus({
  onchainApplicationId,
  stakeTx,
  className,
}: {
  onchainApplicationId?: string;
  stakeTx?: string;
  className?: string;
}) {
  const id = onchainApplicationId ? BigInt(onchainApplicationId) : undefined;

  const { data, isLoading } = useQuery({
    queryKey: ["onchain-application", onchainApplicationId],
    queryFn: () => getApplicationOnchain(id!),
    enabled: id !== undefined,
    refetchInterval: (query) =>
      query.state.data && TERMINAL_STATUSES.includes(query.state.data.status) ? false : 15_000,
  });

  if (!onchainApplicationId) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-2 text-xs", className)}>
      {isLoading ? (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Loader2 className="size-3 animate-spin" /> Reading chain…
        </span>
      ) : (
        <Badge className={cn("font-normal", STATUS_TONE[data?.status ?? "Unknown"])}>
          {STATUS_LABEL[data?.status ?? "Unknown"]}
          {data ? ` · ${stroopsToXlm(data.applicantStake)} XLM` : null}
        </Badge>
      )}
      {stakeTx && (
        <a
          href={stellarExpertTxUrl(stakeTx)}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          View onchain <ExternalLink className="size-3" />
        </a>
      )}
    </div>
  );
}
