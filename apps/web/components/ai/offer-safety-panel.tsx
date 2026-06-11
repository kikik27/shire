import { ShieldCheck } from "lucide-react";
import type { OfferSafety } from "@/lib/types";
import { RiskScoreBadge } from "@/components/trust/scores";

export function OfferSafetyPanel({ safety }: { safety: OfferSafety }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
          Offer safety
        </p>
        <RiskScoreBadge level={safety.offerSafetyLevel} />
      </div>
      {safety.flags.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {safety.flags.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm text-foreground/90">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-warning" />
              {f}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">No safety concerns detected.</p>
      )}
      <p className="mt-3 text-sm text-muted-foreground">{safety.recommendation}</p>
    </div>
  );
}
