"use client";

import * as React from "react";
import { toast } from "sonner";
import type { Stake } from "@/lib/types";
import { StakeStatus } from "@/lib/types";
import { getCandidateById, getRecruiterById, ME_CANDIDATE_ID, useShireStore } from "@/lib/store";
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
import { StakeStatusBadge, stakeTypeLabel } from "@/components/stake/stake-status-badge";
import { formatToken, truncateAddress } from "@/lib/format";

function partyLabel(userId: string, recruiterProfile: Parameters<typeof getRecruiterById>[0]["recruiterProfile"]) {
  if (userId === ME_CANDIDATE_ID) return "You";
  const rec = getRecruiterById({ recruiterProfile }, userId);
  if (rec) return rec.companyName;
  return getCandidateById(userId)?.displayName ?? truncateAddress(userId);
}

export function AdminStakeTable() {
  const stakes = useShireStore((s) => s.stakes);
  const recruiterProfile = useShireStore((s) => s.recruiterProfile);
  const refundStake = useShireStore((s) => s.refundStake);
  const slashStake = useShireStore((s) => s.slashStake);

  const [target, setTarget] = React.useState<Stake | null>(null);
  const [reason, setReason] = React.useState("");

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
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
              const locked = stake.status === StakeStatus.Locked;
              return (
                <TableRow key={stake.id}>
                  <TableCell className="pl-4 font-medium">
                    {partyLabel(stake.userId, recruiterProfile)}
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                    {stakeTypeLabel[stake.stakeType]}
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
                          onClick={() => {
                            refundStake(stake.id);
                            toast.success("Stake refunded");
                          }}
                        >
                          Refund
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
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
              Slashing forfeits the staked funds. Record a clear reason — this is part of the
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
              placeholder="e.g. Confirmed scam — requested off-platform deposit."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!reason.trim()}
              onClick={() => {
                if (!target) return;
                slashStake(target.id, target.amount, reason.trim());
                toast("Stake slashed", { description: "Recorded on the dispute trail." });
                setTarget(null);
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
