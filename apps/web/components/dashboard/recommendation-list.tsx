"use client";

import { Sparkles } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  useCandidateRecommendations,
  useRecruiterRecommendations,
  type Recommendation,
} from "@/lib/hooks/use-recommendations";

function actionBadgeClass(action: string) {
  if (action === "SUGGEST_APPLY" || action === "SUGGEST_INVITE") {
    return "bg-success/10 text-success";
  }
  if (action === "SAVE_ONLY") {
    return "bg-warning/15 text-warning-foreground";
  }
  return "bg-muted text-muted-foreground";
}

function ScoreBar({ score }: { score: number }) {
  const tone =
    score >= 85 ? "bg-success" : score >= 70 ? "bg-warning" : "bg-muted-foreground";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", tone)}
          style={{ width: `${Math.min(100, score)}%` }}
        />
      </div>
      <span className="text-xs font-medium tabular-nums text-muted-foreground">
        {score}
      </span>
    </div>
  );
}

function fallbackCandidateLabel(recommendation: Recommendation) {
  return `Candidate ${recommendation.candidateUserId.slice(0, 8)}`;
}

function fallbackJobLabel(recommendation: Recommendation) {
  return recommendation.jobId ? `Job ${recommendation.jobId.slice(0, 8)}` : "Selected job";
}

function RecommendationRow({ recommendation }: { recommendation: Recommendation }) {
  const isTalentRecommendation = recommendation.type === "TALENT_TO_COMPANY";
  const primaryLabel = isTalentRecommendation
    ? recommendation.candidate?.displayName ?? fallbackCandidateLabel(recommendation)
    : recommendation.job?.title ?? fallbackJobLabel(recommendation);
  const secondaryLabel = isTalentRecommendation
    ? recommendation.candidate?.headline ??
      recommendation.candidate?.roleTargets[0] ??
      "Candidate profile"
    : recommendation.job
      ? `${recommendation.job.companyName} - ${recommendation.job.location}${recommendation.job.remote ? " - Remote" : ""}`
      : "Recommended job";
  const contextLabel = isTalentRecommendation
    ? recommendation.job
      ? `For ${recommendation.job.title} at ${recommendation.job.companyName}`
      : recommendation.jobId
        ? `For ${fallbackJobLabel(recommendation)}`
        : undefined
    : recommendation.candidate?.displayName
      ? `Matched to ${recommendation.candidate.displayName}`
      : undefined;
  const skills = isTalentRecommendation
    ? recommendation.candidate?.skills
    : recommendation.job?.skillsRequired;

  return (
    <li className="border-b border-border/60 px-4 py-3 last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div>
            <p className="truncate text-sm font-medium text-foreground">
              {primaryLabel}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {secondaryLabel}
            </p>
            {contextLabel && (
              <p className="truncate text-[11px] text-muted-foreground">
                {contextLabel}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                actionBadgeClass(recommendation.recommendedAction),
              )}
            >
              {recommendation.recommendedAction.replace(/_/g, " ").toLowerCase()}
            </span>
            {recommendation.confidence !== undefined && (
              <span className="text-[11px] text-muted-foreground">
                {(recommendation.confidence * 100).toFixed(0)}% confidence
              </span>
            )}
          </div>
          {skills && skills.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {skills.slice(0, 4).map((skill) => (
                <span
                  key={skill}
                  className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                >
                  {skill}
                </span>
              ))}
            </div>
          )}
          {recommendation.reasons.length > 0 && (
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {recommendation.reasons.join(" / ")}
            </p>
          )}
          {recommendation.missingRequirements.length > 0 && (
            <p className="text-[11px] text-warning-foreground">
              Missing: {recommendation.missingRequirements.join(", ")}
            </p>
          )}
        </div>
        <ScoreBar score={recommendation.matchScore} />
      </div>
    </li>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <Sparkles className="size-5 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export function CandidateRecommendations() {
  const { data, isLoading, error } = useCandidateRecommendations();

  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Recommended jobs</CardTitle>
        <span className="rounded-full border border-border bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground">
          Updates every 15 min
        </span>
      </CardHeader>
      <CardContent className="px-0">
        {isLoading ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            Loading recommendations...
          </div>
        ) : error ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            Could not load recommendations.
          </div>
        ) : !data || data.length === 0 ? (
          <EmptyState message="No job recommendations yet. Shire refreshes matches automatically every 15 minutes." />
        ) : (
          <ul>
            {data.map((recommendation) => (
              <RecommendationRow
                key={recommendation.id}
                recommendation={recommendation}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function RecruiterRecommendations({ jobId }: { jobId?: string }) {
  const { data, isLoading, error } = useRecruiterRecommendations();
  const filteredData = jobId
    ? data?.filter((recommendation) => recommendation.jobId === jobId)
    : data;

  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Talent recommendations</CardTitle>
        <span className="rounded-full border border-border bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground">
          Updates every 15 min
        </span>
      </CardHeader>
      <CardContent className="px-0">
        {isLoading ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            Loading recommendations...
          </div>
        ) : error ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            Could not load recommendations.
          </div>
        ) : !filteredData || filteredData.length === 0 ? (
          <EmptyState message="No talent recommendations yet. Shire refreshes matches automatically every 15 minutes." />
        ) : (
          <ul>
            {filteredData.map((recommendation) => (
              <RecommendationRow
                key={recommendation.id}
                recommendation={recommendation}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
