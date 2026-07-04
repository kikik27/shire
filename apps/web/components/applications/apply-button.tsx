"use client";

import * as React from "react";
import { CheckCircle2, Loader2, Send, UserCircle } from "lucide-react";
import { toast } from "sonner";
import type { Job } from "@/lib/types";
import { useWallet } from "@/lib/wallet/use-wallet";
import { useApplyJob, useMyApplications } from "@/lib/hooks/use-applications";
import {
  useCreatePlatformStake,
  usePlatformStakes,
} from "@/lib/hooks/use-stakes";
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
import { ApplicationStatusBadge } from "@/components/applications/application-status-badge";
import { formatToken } from "@/lib/format";

export function ApplyButton({ job, className }: { job: Job; className?: string }) {
  const { data: applications = [] } = useMyApplications();
  const applyJob = useApplyJob();
  const createStake = useCreatePlatformStake();
  const { data: stakes = [] } = usePlatformStakes();
  const application = applications.find((a) => a.jobId === job.id);
  const { isConnected, connect } = useWallet();

  const [open, setOpen] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const needsStake = Boolean(
    job.candidateStakeRequired && job.candidateStakeAmount,
  );
  const recordedStake = application
    ? stakes.find(
        (stake) =>
          stake.type === "APPLICATION" &&
          stake.applicationId === application.id,
      )
    : undefined;

  async function recordApplicationStake(applicationId: string) {
    if (!job.candidateStakeAmount) return;
    await createStake.mutateAsync({
      type: "APPLICATION",
      amount: job.candidateStakeAmount,
      token: job.stakeToken,
      idempotencyKey: `application:${applicationId}`,
      applicationId,
      jobId: job.id,
    });
  }

  if (application && application.status !== "WITHDRAWN") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
          <CheckCircle2 className="size-4" /> Applied
        </span>
        <ApplicationStatusBadge status={application.status} />
        {needsStake && !recordedStake && (
          <Button
            size="sm"
            variant="outline"
            disabled={createStake.isPending}
            onClick={() => {
              void recordApplicationStake(application.id)
                .then(() => toast.success("Platform escrow recorded"))
                .catch(() => toast.error("Platform escrow failed"));
            }}
          >
            Record required escrow
          </Button>
        )}
      </div>
    );
  }

  async function submit() {
    if (!isConnected) {
      await connect();
      return;
    }
    setSubmitting(true);
    try {
      const createdApplication = await applyJob.mutateAsync({
        jobId: job.id,
        message: message.trim() || "I'd love to be considered for this role.",
        stakeAmount: needsStake ? job.candidateStakeAmount : undefined,
      });
      if (needsStake) {
        try {
          await recordApplicationStake(createdApplication.id);
        } catch {
          setOpen(false);
          toast.warning("Application sent; escrow is still pending", {
            description: "Use the application action to retry platform escrow.",
          });
          return;
        }
      }
      setOpen(false);
      toast.success("Application sent", {
        description: needsStake
          ? `Recorded ${formatToken(job.candidateStakeAmount!, job.stakeToken)} in platform escrow.`
          : undefined,
      });
    } catch (error) {
      toast.error("Application was not sent", {
        description:
          error instanceof Error ? error.message : "Try again in a moment.",
      });
    } finally {
      setSubmitting(false);
    }
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

        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Your application will be saved to your account and visible to the recruiter.
        </p>

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
              Recorded in platform escrow and refundable under the dispute policy.
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
                <UserCircle className="size-4" /> Sign in to apply
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
