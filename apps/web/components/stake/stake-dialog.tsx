"use client";

import * as React from "react";
import { Check, Loader2, Lock, ShieldCheck, UserCircle } from "lucide-react";
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
  confirmLabel = "Lock platform escrow",
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
  onConfirm: (amount: number) => void | Promise<void>;
}) {
  const { isConnected, connect } = useWallet();
  const [value, setValue] = React.useState(amount);
  const [phase, setPhase] = React.useState<Phase>("idle");

  function changeOpen(nextOpen: boolean) {
    if (phase === "confirming") return;
    if (!nextOpen) {
      setValue(amount);
      setPhase("idle");
    }
    onOpenChange(nextOpen);
  }

  async function run() {
    if (!isConnected) {
      await connect();
      return;
    }
    setPhase("confirming");
    try {
      await onConfirm(value);
      setPhase("done");
      toast.success("Platform escrow recorded", {
        description: `${formatToken(value, token)} locked by the platform.`,
      });
      setTimeout(() => {
        setValue(amount);
        setPhase("idle");
        onOpenChange(false);
      }, 900);
    } catch (error) {
      setPhase("idle");
      toast.error("Request failed", {
        description:
          error instanceof Error ? error.message : "Try again in a moment.",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border bg-muted/40 p-4 text-center">
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
          <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Recording platform escrow
          </div>
        ) : phase === "done" ? (
          <div className="flex items-center justify-center gap-2 py-2 text-sm font-medium text-success">
            <Check className="size-4" /> Platform escrow recorded
          </div>
        ) : (
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <Lock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              Funds are recorded in platform escrow.
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
                  <UserCircle className="size-4" /> Sign in to continue
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
