"use client";

import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { RecruiterDashboard } from "@/lib/server/recruiter-dashboard-repository";

const chartConfig = {
  applications: { label: "Applications", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function ActivityChart({
  activity,
}: {
  activity: RecruiterDashboard["activity"];
}) {
  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Application activity</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Daily applications over the last 30 days
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-chart-1" /> Applications
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {activity.length === 0 ? (
          <p className="grid h-[260px] place-items-center text-sm text-muted-foreground">
            Application activity will appear here.
          </p>
        ) : (
        <ChartContainer config={chartConfig} className="aspect-auto h-[260px] w-full">
          <AreaChart data={activity} margin={{ left: 4, right: 4, top: 8 }}>
            <defs>
              <linearGradient id="fillApplications" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-applications)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="var(--color-applications)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={(value: string) => value.slice(5)}
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
          </AreaChart>
        </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
