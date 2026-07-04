import { Coins } from "lucide-react";
import type { TokenSymbol } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatToken } from "@/lib/format";

export function StakeRecommendationCard({
  recruiterStake,
  candidateStakeRequired,
  candidateStake,
  token,
}: {
  recruiterStake: number;
  candidateStakeRequired: boolean;
  candidateStake?: number;
  token: TokenSymbol;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <Coins className="size-4 text-primary" aria-hidden="true" />
        <CardTitle className="text-base">Stake terms</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-3">
          <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
            <Coins className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="font-mono text-lg font-semibold tabular-nums">
              {formatToken(recruiterStake, token)}
            </p>
            <p className="text-xs text-muted-foreground">Recruiter stake</p>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
          <span className="text-muted-foreground">Candidate stake</span>
          <span className="font-medium">
            {candidateStakeRequired
              ? formatToken(candidateStake ?? 0, token)
              : "Not required"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
