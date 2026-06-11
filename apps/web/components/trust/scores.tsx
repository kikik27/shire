import { AlertTriangle, ShieldAlert, ShieldCheck, ShieldQuestion, Sparkles } from "lucide-react";
import type { RiskLevel } from "@/lib/types";
import { cn } from "@/lib/utils";

const riskStyle: Record<RiskLevel, { label: string; cls: string; Icon: typeof ShieldCheck }> = {
  LOW: { label: "Low risk", cls: "bg-success/10 text-success", Icon: ShieldCheck },
  MEDIUM: { label: "Medium risk", cls: "bg-warning/15 text-warning-foreground", Icon: ShieldAlert },
  HIGH: { label: "High risk", cls: "bg-destructive/10 text-destructive", Icon: AlertTriangle },
  UNKNOWN: { label: "Unscored", cls: "bg-muted text-muted-foreground", Icon: ShieldQuestion },
};

export function RiskScoreBadge({
  level,
  score,
  className,
}: {
  level: RiskLevel;
  score?: number;
  className?: string;
}) {
  const s = riskStyle[level];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        s.cls,
        className,
      )}
    >
      <s.Icon className="size-3.5" aria-hidden="true" />
      {s.label}
      {typeof score === "number" && (
        <span className="font-mono tabular-nums opacity-80">· {score}</span>
      )}
    </span>
  );
}

function matchTone(score: number) {
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-primary";
  if (score >= 40) return "text-warning-foreground";
  return "text-muted-foreground";
}

export function MatchScoreBadge({ score, className }: { score: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium",
        matchTone(score),
        className,
      )}
    >
      <Sparkles className="size-3.5" aria-hidden="true" />
      <span className="font-mono tabular-nums">{score}%</span> match
    </span>
  );
}

/** Compact horizontal score meter (0–100). */
export function ScoreMeter({
  value,
  tone = "primary",
  className,
}: {
  value: number;
  tone?: "primary" | "success" | "warning" | "destructive";
  className?: string;
}) {
  const toneCls = {
    primary: "bg-primary",
    success: "bg-success",
    warning: "bg-warning",
    destructive: "bg-destructive",
  }[tone];
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div
        className={cn("h-full rounded-full transition-[width] duration-500", toneCls)}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

/** Radial score ring for hero/detail surfaces. */
export function ScoreRing({
  value,
  label,
  size = 96,
}: {
  value: number;
  label?: string;
  size?: number;
}) {
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  const tone = value >= 80 ? "text-success" : value >= 60 ? "text-primary" : value >= 40 ? "text-warning" : "text-muted-foreground";
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} className="stroke-muted" strokeWidth={6} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className={cn("transition-[stroke-dashoffset] duration-700", tone)}
          stroke="currentColor"
          strokeWidth={6}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * Math.max(0, Math.min(100, value))) / 100}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-mono text-xl font-semibold tabular-nums">{value}</span>
        {label && <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>}
      </div>
    </div>
  );
}
