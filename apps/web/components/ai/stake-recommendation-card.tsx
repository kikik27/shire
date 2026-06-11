import { Coins, Sparkles } from "lucide-react";
import type { StakeRecommendation } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function StakeRecommendationCard({ rec }: { rec: StakeRecommendation }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <Sparkles className="size-4 text-primary" aria-hidden="true" />
        <CardTitle className="text-base">AI stake recommendation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3">
          <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
            <Coins className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="font-mono text-lg font-semibold tabular-nums">
              {rec.recommendedRecruiterStake}
            </p>
            <p className="text-xs text-muted-foreground">Recommended recruiter stake</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{rec.stakeReason}</p>
        <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
          <span className="text-muted-foreground">Candidate stake</span>
          <span className="font-medium">{rec.candidateStakeRequired ? "Required" : "Optional"}</span>
        </div>
        <p className="text-xs text-muted-foreground">{rec.refundPolicy}</p>
      </CardContent>
    </Card>
  );
}
