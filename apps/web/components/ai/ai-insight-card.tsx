import { Lightbulb, Sparkles } from "lucide-react";
import type { MatchResult } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScoreRing } from "@/components/trust/scores";

export function AiInsightCard({ match }: { match: MatchResult }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <Sparkles className="size-4 text-primary" aria-hidden="true" />
        <CardTitle className="text-base">AI match analysis</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <ScoreRing value={match.matchScore} label="match" />
          <div>
            <p className="font-semibold text-primary">{match.recommendation}</p>
            <p className="mt-1 text-sm text-muted-foreground">{match.reason}</p>
          </div>
        </div>

        {match.missingSkills.length > 0 && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Skills to close
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {match.missingSkills.map((s) => (
                <span
                  key={s}
                  className="rounded-md bg-warning/10 px-2 py-0.5 text-xs text-warning-foreground"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-start gap-2 rounded-lg bg-primary/5 p-3">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <p className="text-sm text-foreground/90">{match.applyAdvice}</p>
        </div>
      </CardContent>
    </Card>
  );
}
