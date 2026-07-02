"use client";

import Link from "next/link";
import { ArrowRight, Briefcase, FileText, RotateCw, Sparkles } from "lucide-react";
import { useCandidateDashboard } from "@/lib/hooks/use-candidate-dashboard";
import { PageHeader } from "@/components/shared/page-header";
import { StatTile } from "@/components/shared/stat-tile";
import { CandidateRecommendationList } from "@/components/dashboard/recommendation-list";
import { ApplicationStatusBadge } from "@/components/applications/application-status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { timeAgo } from "@/lib/format";

function ProfilePrompt() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Candidate profile
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Keep your profile current so matching can use real account data.
        </p>
        <Button asChild size="sm" variant="outline">
          <Link href="/candidate/profile">Update profile</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default function CandidatePage() {
  const {
    data,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useCandidateDashboard();

  return (
    <div className="space-y-8 p-4 sm:p-6">
      <PageHeader
        title="Candidate hub"
        description="Your AI-matched job board and application tracker."
      />

      {isLoading ? (
        <EmptyState
          icon={Sparkles}
          title="Loading candidate dashboard"
          description="Fetching your applications and current recommendations."
        />
      ) : isError || !data ? (
        <EmptyState
          icon={Briefcase}
          title="Dashboard unavailable"
          description="We could not load your candidate dashboard. Retry the request or check your connection."
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
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Active applications"
          value={String(data.activeApplicationCount)}
          icon={FileText}
        />
        <StatTile
          label="Jobs available"
          value={String(data.availableJobCount)}
          icon={Briefcase}
        />
        <StatTile
          label="New matches"
          value={String(data.newRecommendationCount)}
          icon={Sparkles}
        />
      </div>

      <ProfilePrompt />

      <CandidateRecommendationList recommendations={data.recommendations} />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Active applications</h2>
          <Button asChild variant="ghost" size="sm" className="gap-1">
            <Link href="/candidate/applications">
              All <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
        {data.applications.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No active applications"
            description="Apply to a job to get started."
            action={
              <Button asChild size="sm">
                <Link href="/candidate/jobs">Browse jobs</Link>
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            {data.applications.map((app) => (
              <Link
                key={app.id}
                href={`/candidate/jobs/${app.jobId}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 transition-[box-shadow] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{app.job.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {app.job.companyName} - applied {timeAgo(app.createdAt)}
                  </p>
                </div>
                <ApplicationStatusBadge status={app.status} />
              </Link>
            ))}
          </div>
        )}
      </section>
        </>
      )}
    </div>
  );
}
