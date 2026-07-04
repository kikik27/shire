import { Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScoreRing } from "@/components/trust/scores";
import type { CandidateJobMatch } from "@/lib/types";

const actionLabels: Record<string, string> = {
  SUGGEST_APPLY: "Recommended to apply",
  SAVE_ONLY: "Consider saving",
  IGNORE: "Low-priority match",
};

export function AiInsightCard({ match }: { match: CandidateJobMatch }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <Sparkles className="size-4 text-primary" aria-hidden="true" />
        <CardTitle className="text-base">AI match analysis</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <ScoreRing value={match.score} label="match" />
          <div>
            <p className="font-semibold text-primary">
              {actionLabels[match.recommendedAction] ?? "Match evaluated"}
            </p>
            {match.confidence !== undefined && (
              <p className="mt-1 text-sm text-muted-foreground">
                {Math.round(match.confidence * 100)}% confidence
              </p>
            )}
          </div>
        </div>

        {match.reasons.length > 0 && (
          <ul className="space-y-1 text-sm text-muted-foreground">
            {match.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        )}

        {match.missingRequirements.length > 0 && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Requirements to address
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {match.missingRequirements.map((requirement) => (
                <span
                  key={requirement}
                  className="rounded-md bg-warning/10 px-2 py-0.5 text-xs text-warning-foreground"
                >
                  {requirement}
                </span>
              ))}
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  );
}
