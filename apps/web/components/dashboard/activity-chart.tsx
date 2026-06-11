"use client";

import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { activitySeries } from "@/lib/dashboard-data";

const chartConfig = {
  applications: { label: "Applications", color: "var(--chart-1)" },
  matches: { label: "Matches", color: "var(--chart-2)" },
} satisfies ChartConfig;

export function ActivityChart() {
  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Application activity</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Applications vs. accepted matches, this year
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-chart-1" /> Applications
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-chart-2" /> Matches
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-[260px] w-full">
          <AreaChart data={activitySeries} margin={{ left: 4, right: 4, top: 8 }}>
            <defs>
              <linearGradient id="fillApplications" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-applications)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="var(--color-applications)" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="fillMatches" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-matches)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-matches)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              fontSize={12}
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
            <Area
              dataKey="applications"
              type="monotone"
              stroke="var(--color-applications)"
              strokeWidth={2}
              fill="url(#fillApplications)"
              stackId="a"
            />
            <Area
              dataKey="matches"
              type="monotone"
              stroke="var(--color-matches)"
              strokeWidth={2}
              fill="url(#fillMatches)"
              stackId="b"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
