"use client";

import * as React from "react";
import { toast } from "sonner";
import { useAdminStakes, useTransitionStake } from "@/lib/hooks/use-admin";
import type { PlatformStake } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  platformStakeTypeLabel,
  StakeStatusBadge,
} from "@/components/stake/stake-status-badge";
import { formatToken } from "@/lib/format";
import { EmptyState } from "@/components/shared/empty-state";
import { Zap } from "lucide-react";

export function AdminStakeTable() {
  const { data, isLoading, isError } = useAdminStakes();
  const transitionStake = useTransitionStake();
  const stakes = data?.stakes ?? [];

  const [target, setTarget] = React.useState<PlatformStake | null>(null);
  const [reason, setReason] = React.useState("");

  if (isLoading) {
    return (
      <EmptyState
        icon={Zap}
        title="Loading platform escrow"
        description="Fetching persisted stake records."
      />
    );
  }
  if (isError || stakes.length === 0) {
    return (
      <EmptyState
        icon={Zap}
        title={isError ? "Platform escrow unavailable" : "No stake records"}
        description={
          isError
            ? "Admin stake data could not be loaded."
            : "Platform escrow records will appear here."
        }
      />
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Party</TableHead>
              <TableHead className="hidden sm:table-cell">Type</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead className="hidden md:table-cell">Status</TableHead>
              <TableHead className="pr-4 text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stakes.map((stake) => {
              const locked = stake.status === "LOCKED";
              return (
                <TableRow key={stake.id}>
                  <TableCell className="pl-4 font-medium">
                    User {stake.ownerUserId.slice(0, 8)}
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                    {platformStakeTypeLabel[stake.type]}
                  </TableCell>
                  <TableCell className="font-mono text-sm tabular-nums">
                    {formatToken(stake.amount, stake.token)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <StakeStatusBadge status={stake.status} />
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    {locked ? (
                      <div className="flex justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={transitionStake.isPending}
                          onClick={() => {
                            transitionStake.mutate(
                              {
                                id: stake.id,
                                status: "REFUNDED",
                                reason: "Admin refund",
                              },
                              {
                                onSuccess: () =>
                                  toast.success("Stake refunded"),
                                onError: () =>
                                  toast.error("Stake refund failed"),
                              },
                            );
                          }}
                        >
                          Refund
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={transitionStake.isPending}
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            setTarget(stake);
                            setReason("");
                          }}
                        >
                          Slash
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Settled</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Slash stake</DialogTitle>
            <DialogDescription>
              Slashing forfeits the staked funds. Record a clear reason. This is part of the
              dispute record.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="slash-reason">Reason</Label>
            <Textarea
              id="slash-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Confirmed scam, requested off-platform deposit."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!reason.trim() || transitionStake.isPending}
              onClick={() => {
                if (!target) return;
                transitionStake.mutate(
                  {
                    id: target.id,
                    status: "SLASHED",
                    reason: reason.trim(),
                  },
                  {
                    onSuccess: () => {
                      toast("Stake slashed", {
                        description: "Recorded in the audit trail.",
                      });
                      setTarget(null);
                    },
                    onError: () => toast.error("Stake slash failed"),
                  },
                );
              }}
            >
              Confirm slash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
