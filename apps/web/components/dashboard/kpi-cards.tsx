import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { kpis } from "@/lib/dashboard-data";
import { cn } from "@/lib/utils";

export function KpiCards() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi) => {
        const up = kpi.trend === "up";
        const Arrow = up ? ArrowUpRight : ArrowDownRight;
        return (
          <Card key={kpi.id} className="gap-0 p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">{kpi.label}</p>
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium",
                  "bg-success/10 text-success",
                )}
              >
                <Arrow className="size-3" aria-hidden="true" />
                <span className="font-mono tabular-nums">{kpi.delta}</span>
              </span>
            </div>
            <p className="mt-3 font-mono text-3xl font-semibold tracking-tight tabular-nums">
              {kpi.value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{kpi.hint}</p>
          </Card>
        );
      })}
    </div>
  );
}
