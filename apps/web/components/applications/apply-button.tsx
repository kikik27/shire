"use client";

import * as React from "react";
import { CheckCircle2, Loader2, Send, Wallet } from "lucide-react";
import { toast } from "sonner";
import type { Job } from "@/lib/types";
import { ME_CANDIDATE_ID, useShireStore } from "@/lib/store";
import { computeMatch } from "@/lib/ai";
import { useWallet } from "@/lib/wallet/use-wallet";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { MatchScoreBadge } from "@/components/trust/scores";
import { ApplicationStatusBadge } from "@/components/applications/application-status-badge";
import { formatToken } from "@/lib/format";

export function ApplyButton({ job, className }: { job: Job; className?: string }) {
  const candidateProfile = useShireStore((s) => s.candidateProfile);
  const applyToJob = useShireStore((s) => s.applyToJob);
  const application = useShireStore((s) =>
    s.applications.find((a) => a.jobId === job.id && a.candidateId === ME_CANDIDATE_ID),
  );
  const { isConnected, connect } = useWallet();

  const [open, setOpen] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  if (application && application.status !== "WITHDRAWN") {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
          <CheckCircle2 className="size-4" /> Applied
        </span>
        <ApplicationStatusBadge status={application.status} />
      </div>
    );
  }

  const match = computeMatch(job, candidateProfile);
  const needsStake = job.candidateStakeRequired && job.candidateStakeAmount;

  async function submit() {
    if (!isConnected) {
      await connect();
      return;
    }
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, needsStake ? 1100 : 500));
    applyToJob(
      job.id,
      message.trim() || "I'd love to be considered for this role.",
      needsStake ? { stakeAmount: job.candidateStakeAmount, token: job.stakeToken } : undefined,
    );
    setSubmitting(false);
    setOpen(false);
    toast.success("Application sent", {
      description: needsStake ? `Staked ${formatToken(job.candidateStakeAmount!, job.stakeToken)}.` : undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className={className}>
          {needsStake ? `Stake ${formatToken(job.candidateStakeAmount!, job.stakeToken)} & apply` : "Apply now"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Apply to {job.title}</DialogTitle>
          <DialogDescription>{job.companyName}</DialogDescription>
        </DialogHeader>

        {candidateProfile ? (
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2">
            <span className="text-sm text-muted-foreground">Your match</span>
            <MatchScoreBadge score={match.matchScore} />
          </div>
        ) : (
          <p className="rounded-lg border border-warning/40 bg-warning/5 px-3 py-2 text-sm text-muted-foreground">
            Set up your profile first so recruiters and AI can rank your fit.
          </p>
        )}

        <div className="space-y-2">
          <Label htmlFor="apply-message">Message to the recruiter</Label>
          <Textarea
            id="apply-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="A sentence on why you're a strong fit."
          />
        </div>

        {needsStake && (
          <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
            <p className="font-medium">
              This role requires a {formatToken(job.candidateStakeAmount!, job.stakeToken)} stake
            </p>
            <p className="text-muted-foreground">
              Locked in escrow to signal you&apos;re serious. Refunded unless you ghost the process.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button onClick={submit} disabled={submitting} size="lg" className="w-full">
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Submitting…
              </>
            ) : !isConnected ? (
              <>
                <Wallet className="size-4" /> Connect to apply
              </>
            ) : (
              <>
                <Send className="size-4" /> Send application
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
