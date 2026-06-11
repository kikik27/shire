"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { pipelineBars } from "@/lib/dashboard-data";

const chartConfig = {
  total: { label: "In stage", color: "var(--chart-2)" },
  active: { label: "Active", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function PipelineOverview() {
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
            <span className="size-2 rounded-full bg-chart-2" /> In stage
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-chart-1" /> Active
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-[240px] w-full">
          <BarChart data={pipelineBars} margin={{ left: 4, right: 4, top: 8 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="stage"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              fontSize={12}
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <Bar dataKey="total" fill="var(--color-total)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="active" fill="var(--color-active)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
