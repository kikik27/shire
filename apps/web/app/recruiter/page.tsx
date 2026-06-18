"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { TalentReach } from "@/components/dashboard/talent-reach";
import { CatalogTable } from "@/components/dashboard/catalog-table";
import { ActivityChart } from "@/components/dashboard/activity-chart";
import { MatchDonut } from "@/components/dashboard/match-donut";
import { PipelineOverview } from "@/components/dashboard/pipeline-overview";
import { PipelineLists } from "@/components/dashboard/pipeline-lists";

export default function RecruiterPage() {
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Your hiring and applications at a glance</p>
        </div>
        <Button asChild size="sm">
          <Link href="/recruiter/jobs/new">Post a job</Link>
        </Button>
      </div>

      <KpiCards />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <TalentReach />
        <CatalogTable />
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <ActivityChart />
        <MatchDonut />
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_2fr]">
        <PipelineOverview />
        <PipelineLists />
      </div>
    </div>
  );
}
