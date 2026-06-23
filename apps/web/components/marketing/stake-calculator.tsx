"use client";

import * as React from "react";
import { Check, ShieldX } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Reveal } from "@/components/marketing/reveal";

const MIN = 50;
const MAX = 1000;
const STEP = 50;

/**
 * A mini stake calculator: drag the amount and see the two outcomes side by
 * side, refunded on a successful hire, forfeited only if a resolver rules
 * against you. Makes the "stake, not cost" mechanic click instantly.
 */
export function StakeCalculator() {
  const [amount, setAmount] = React.useState(250);

  return (
    <Reveal>
      <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-border bg-background p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-base font-semibold tracking-tight">Try a stake amount</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Both sides lock the same amount. Here&apos;s what happens to it.
            </p>
          </div>
          <div className="text-right">
            <span className="font-mono text-3xl font-semibold tabular-nums text-primary">
              {amount.toLocaleString()}
            </span>
            <span className="ml-1 text-sm text-muted-foreground">cUSD</span>
          </div>
        </div>

        <Slider
          value={[amount]}
          min={MIN}
          max={MAX}
          step={STEP}
          onValueChange={(v) => setAmount(v[0])}
          aria-label="Stake amount in cUSD"
          className="mt-6"
        />
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>{MIN} cUSD</span>
          <span>{MAX} cUSD</span>
        </div>

        {/* outcomes */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="flex items-start gap-3 rounded-xl border border-success/30 bg-success/[0.04] p-4">
            <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-success text-success-foreground">
              <Check className="size-3.5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">Hire succeeds</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                <span className="font-mono font-medium text-success">
                  +{amount.toLocaleString()} cUSD
                </span>{" "}
                refunded to you, automatically.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/[0.04] p-4">
            <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-destructive text-destructive-foreground">
              <ShieldX className="size-3.5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">Resolver rules against you</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                <span className="font-mono font-medium text-destructive">
                  −{amount.toLocaleString()} cUSD
                </span>{" "}
                released to the other side.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Reveal>
  );
}
