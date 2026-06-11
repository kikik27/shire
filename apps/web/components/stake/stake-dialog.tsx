"use client";

import * as React from "react";
import { Check, Loader2, Lock, ShieldCheck, Wallet } from "lucide-react";
import { toast } from "sonner";
import type { TokenSymbol } from "@/lib/types";
import { useWallet } from "@/lib/wallet/use-wallet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { formatToken } from "@/lib/format";
import { cn } from "@/lib/utils";

type Phase = "idle" | "confirming" | "done";

export function StakeDialog({
  open,
  onOpenChange,
  title,
  description,
  amount,
  token = "cUSD",
  adjustable = false,
  min = 1,
  max = 50,
  refundPolicy,
  confirmLabel = "Approve & lock stake",
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  amount: number;
  token?: TokenSymbol;
  adjustable?: boolean;
  min?: number;
  max?: number;
  refundPolicy?: string;
  confirmLabel?: string;
  onConfirm: (amount: number) => void;
}) {
  const { isConnected, connect } = useWallet();
  const [value, setValue] = React.useState(amount);
  const [phase, setPhase] = React.useState<Phase>("idle");

  React.useEffect(() => {
    if (open) {
      setValue(amount);
      setPhase("idle");
    }
  }, [open, amount]);

  async function run() {
    if (!isConnected) {
      await connect();
      return;
    }
    setPhase("confirming");
    await new Promise((r) => setTimeout(r, 1200));
    onConfirm(value);
    setPhase("done");
    toast.success("Stake locked", {
      description: `${formatToken(value, token)} held in escrow.`,
    });
    setTimeout(() => onOpenChange(false), 900);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => phase !== "confirming" && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-border bg-muted/40 p-4 text-center">
          <p className="text-xs text-muted-foreground">You will lock</p>
          <p className="mt-1 font-mono text-3xl font-semibold tabular-nums">
            {formatToken(value, token)}
          </p>
          {adjustable && phase === "idle" && (
            <div className="mt-4 px-1">
              <Label className="sr-only">Stake amount</Label>
              <Slider
                value={[value]}
                min={min}
                max={max}
                step={1}
                onValueChange={([v]) => setValue(v)}
              />
              <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                <span>{min} {token}</span>
                <span>{max} {token}</span>
              </div>
            </div>
          )}
        </div>

        {phase === "confirming" ? (
          <TxTimeline />
        ) : phase === "done" ? (
          <div className="flex items-center justify-center gap-2 py-2 text-sm font-medium text-success">
            <Check className="size-4" /> Stake confirmed onchain
          </div>
        ) : (
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <Lock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              Funds are locked in escrow, not spent.
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              {refundPolicy ?? "Refundable when the job closes without a valid dispute."}
            </li>
          </ul>
        )}

        <DialogFooter>
          {phase === "idle" && (
            <Button onClick={run} className="w-full" size="lg">
              {isConnected ? (
                confirmLabel
              ) : (
                <>
                  <Wallet className="size-4" /> Connect to stake
                </>
              )}
            </Button>
          )}
          {phase === "confirming" && (
            <Button disabled className="w-full" size="lg">
              <Loader2 className="size-4 animate-spin" /> Confirming…
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TxTimeline() {
  const steps = ["Submitting", "Confirming", "Locking escrow"];
  return (
    <ol className="space-y-2">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-2 text-sm">
          <span
            className={cn(
              "grid size-5 place-items-center rounded-full",
              i < 2 ? "bg-primary text-primary-foreground" : "bg-primary/15 text-primary",
            )}
          >
            {i < 2 ? <Check className="size-3" /> : <Loader2 className="size-3 animate-spin" />}
          </span>
          <span className={i < 2 ? "text-foreground" : "text-muted-foreground"}>{s}</span>
        </li>
      ))}
    </ol>
  );
}
