"use client";

import Link from "next/link";
import { BarChart3, RotateCw } from "lucide-react";
import { useRecruiterDashboard } from "@/lib/hooks/use-recruiter-dashboard";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { TalentReach } from "@/components/dashboard/talent-reach";
import { CatalogTable } from "@/components/dashboard/catalog-table";
import { ActivityChart } from "@/components/dashboard/activity-chart";
import { MatchDonut } from "@/components/dashboard/match-donut";
import { PipelineOverview } from "@/components/dashboard/pipeline-overview";
import { PipelineLists } from "@/components/dashboard/pipeline-lists";
import { RecruiterRecommendations } from "@/components/dashboard/recommendation-list";

function DashboardSkeleton() {
  return (
    <div
      className="space-y-6"
      role="status"
      aria-label="Loading recruiter dashboard"
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-32 rounded-lg" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Skeleton className="h-80 rounded-lg" />
        <Skeleton className="h-80 rounded-lg" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Skeleton className="h-80 rounded-lg" />
        <Skeleton className="h-80 rounded-lg" />
      </div>
    </div>
  );
}

export default function RecruiterPage() {
  const {
    data,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useRecruiterDashboard();

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Your hiring and applications at a glance</p>
        </div>
        <Button asChild size="sm">
          <Link href="/recruiter/jobs/new">Post a job</Link>
        </Button>
      </div>

      {isLoading ? (
        <DashboardSkeleton />
      ) : isError || !data ? (
        <EmptyState
          icon={BarChart3}
          title="Dashboard unavailable"
          description="We could not load your recruiter dashboard. Retry the request or check your connection."
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
          <KpiCards kpis={data.kpis} />

          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <TalentReach regions={data.talentRegions} />
            <CatalogTable jobs={data.catalog} />
          </div>

          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <ActivityChart activity={data.activity} />
            <MatchDonut distribution={data.matchDistribution} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <PipelineOverview pipeline={data.pipeline} />
            <PipelineLists
              recentApplicants={data.recentApplicants}
              pipeline={data.pipeline}
            />
          </div>

          <RecruiterRecommendations />
        </>
      )}
    </div>
  );
}
