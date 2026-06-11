import { AlertTriangle, Info, ShieldCheck } from "lucide-react";
import type { RiskResult } from "@/lib/types";
import { ScoreMeter } from "@/components/trust/scores";
import { cn } from "@/lib/utils";

export function WarningPanel({ risk }: { risk: RiskResult }) {
  const tone =
    risk.riskLevel === "HIGH"
      ? { wrap: "border-destructive/30 bg-destructive/5", icon: "text-destructive", Icon: AlertTriangle, meter: "destructive" as const }
      : risk.riskLevel === "MEDIUM"
        ? { wrap: "border-warning/40 bg-warning/5", icon: "text-warning-foreground", Icon: Info, meter: "warning" as const }
        : { wrap: "border-success/30 bg-success/5", icon: "text-success", Icon: ShieldCheck, meter: "success" as const };

  return (
    <div className={cn("rounded-xl border p-4", tone.wrap)}>
      <div className="flex items-start gap-3">
        <tone.Icon className={cn("mt-0.5 size-5 shrink-0", tone.icon)} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">
              AI risk check ·{" "}
              <span className="font-mono tabular-nums">{risk.riskScore}/100</span>
            </p>
            <span className="text-xs text-muted-foreground">
              {Math.round(risk.confidence * 100)}% confidence
            </span>
          </div>
          <ScoreMeter value={risk.riskScore} tone={tone.meter} className="mt-2" />

          {risk.flags.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {risk.flags.map((flag) => (
                <li key={flag} className="flex items-start gap-2 text-sm text-foreground/90">
                  <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", tone.icon, "bg-current")} />
                  {flag}
                </li>
              ))}
            </ul>
          )}

          <p className="mt-3 text-sm text-muted-foreground">{risk.recommendation}</p>
        </div>
      </div>
    </div>
  );
}
