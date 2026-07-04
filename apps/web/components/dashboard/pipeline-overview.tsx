"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { RecruiterDashboard } from "@/lib/server/recruiter-dashboard-repository";

const chartConfig = {
  count: { label: "Candidates", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function PipelineOverview({
  pipeline,
}: {
  pipeline: RecruiterDashboard["pipeline"];
}) {
  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Pipeline overview</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Candidates by stage across active roles
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-chart-1" /> Candidates
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {pipeline.length === 0 ? (
          <p className="grid h-[240px] place-items-center text-sm text-muted-foreground">
            Pipeline activity will appear here.
          </p>
        ) : (
        <ChartContainer config={chartConfig} className="aspect-auto h-[240px] w-full">
          <BarChart data={pipeline} margin={{ left: 4, right: 4, top: 8 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="status"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              fontSize={12}
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
