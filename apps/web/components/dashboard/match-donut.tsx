"use client";

import { Cell, Label, Pie, PieChart } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { RecruiterDashboard } from "@/lib/server/recruiter-dashboard-repository";

const chartConfig = {
  value: { label: "Matches" },
  strong: { label: "Strong match", color: "var(--chart-1)" },
  partial: { label: "Partial match", color: "var(--chart-2)" },
  review: { label: "Needs review", color: "var(--chart-3)" },
} satisfies ChartConfig;

const labels: Record<string, string> = {
  strong: "Strong match",
  partial: "Partial match",
  review: "Needs review",
};

export function MatchDonut({
  distribution,
}: {
  distribution: RecruiterDashboard["matchDistribution"];
}) {
  const slices = distribution
    .filter((item) => item.bucket in labels)
    .map((item) => ({
      key: item.bucket,
      label: labels[item.bucket],
      value: item.count,
    }));
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Match quality</CardTitle>
        <span className="text-xs text-muted-foreground">Current evaluations</span>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        {total === 0 ? (
          <p className="grid h-[260px] place-items-center text-sm text-muted-foreground">
            Match quality will appear here.
          </p>
        ) : (
          <>
        <ChartContainer config={chartConfig} className="aspect-square h-[200px]">
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent nameKey="key" hideLabel />}
            />
            <Pie
              data={slices}
              dataKey="value"
              nameKey="key"
              innerRadius={62}
              outerRadius={88}
              strokeWidth={2}
              paddingAngle={2}
            >
              {slices.map((slice) => (
                <Cell key={slice.key} fill={`var(--color-${slice.key})`} />
              ))}
              <Label
                content={({ viewBox }) => {
                  if (!viewBox || !("cx" in viewBox)) return null;
                  return (
                    <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle">
                      <tspan
                        x={viewBox.cx}
                        y={viewBox.cy}
                        className="fill-foreground font-mono text-2xl font-semibold tabular-nums"
                      >
                        {total.toLocaleString()}
                      </tspan>
                      <tspan
                        x={viewBox.cx}
                        y={(viewBox.cy ?? 0) + 20}
                        className="fill-muted-foreground text-xs"
                      >
                        Matches
                      </tspan>
                    </text>
                  );
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>

        <ul className="mt-2 w-full space-y-2">
          {slices.map((slice) => (
            <li key={slice.key} className="flex items-center gap-2 text-sm">
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: `var(--color-${slice.key})` }}
                aria-hidden="true"
              />
              <span className="text-muted-foreground">{slice.label}</span>
              <span className="ml-auto font-mono font-medium tabular-nums">
                {Math.round((slice.value / total) * 100)}%
              </span>
            </li>
          ))}
        </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
