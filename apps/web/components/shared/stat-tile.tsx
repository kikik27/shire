import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatTile({
  label,
  value,
  hint,
  delta,
  trend,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  delta?: string;
  trend?: "up" | "down";
  icon?: LucideIcon;
}) {
  const Arrow = trend === "down" ? ArrowDownRight : ArrowUpRight;
  return (
    <Card className="gap-0 p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        {Icon ? (
          <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-4" aria-hidden="true" />
          </span>
        ) : delta ? (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-success/10 px-1.5 py-0.5 text-xs font-medium text-success">
            <Arrow className="size-3" aria-hidden="true" />
            <span className="font-mono tabular-nums">{delta}</span>
          </span>
        ) : null}
      </div>
      <p className="mt-3 font-mono text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">
        {value}
      </p>
      {hint && <p className={cn("mt-1 text-xs text-muted-foreground")}>{hint}</p>}
    </Card>
  );
}
