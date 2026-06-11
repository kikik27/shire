"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users, Zap } from "lucide-react";
import { useShireStore, getCandidateById, ME_CANDIDATE_ID } from "@/lib/store";
import { PageHeader } from "@/components/shared/page-header";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";
import { RiskScoreBadge } from "@/components/trust/scores";
import { MatchScoreBadge } from "@/components/trust/scores";
import { ApplicationStatusBadge } from "@/components/applications/application-status-badge";
import { ApplicationTimeline } from "@/components/applications/application-timeline";
import { StakeDialog } from "@/components/stake/stake-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatToken, initials, timeAgo } from "@/lib/format";
import { toast } from "sonner";
import { useState } from "react";
import type { ApplicationStatus } from "@/lib/types";

export default function RecruiterJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const job = useShireStore((s) => s.jobs.find((j) => j.id === id));
  const allApplications = useShireStore((s) => s.applications);
  const applications = allApplications.filter((a) => a.jobId === id);
  const stakeForJob = useShireStore((s) => s.stakeForJob);
  const updateStatus = useShireStore((s) => s.updateApplicationStatus);
  const [stakeOpen, setStakeOpen] = useState(false);

  if (!job) return notFound();

  const isDraft = job.status === "DRAFT";

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <Link
        href="/recruiter/jobs"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        My jobs
      </Link>

      <PageHeader title={job.title} description={job.companyName}>
        <div className="flex items-center gap-2">
          <RiskScoreBadge level={job.riskLevel} score={job.riskScore} />
          <JobStatusBadge status={job.status} />
          {isDraft && (
            <Button size="sm" onClick={() => setStakeOpen(true)}>
              <Zap className="size-4" /> Stake to publish
            </Button>
          )}
        </div>
      </PageHeader>

      <div className="flex flex-wrap gap-1.5">
        {job.skillsRequired.map((skill) => (
          <Badge key={skill} variant="secondary">
            {skill}
          </Badge>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">Stake</p>
          <span className="font-mono text-sm font-semibold tabular-nums text-success">
            {job.stakeAmount > 0 ? formatToken(job.stakeAmount, job.stakeToken) : "Not staked"}
          </span>
        </div>
        {job.candidateStakeRequired && (
          <p className="mt-1 text-xs text-muted-foreground">
            Candidates must stake {job.candidateStakeAmount ?? 5} cUSD to apply.
          </p>
        )}
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">
            Applicants{" "}
            <span className="font-mono text-sm font-normal text-muted-foreground tabular-nums">
              ({applications.length})
            </span>
          </h2>
        </div>
        {applications.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No applicants yet"
            description={
              isDraft
                ? "Stake and publish the job to start receiving applications."
                : "Share the job link to reach more candidates."
            }
          />
        ) : (
          <div className="space-y-3">
            {applications.map((app) => {
              const isMe = app.candidateId === ME_CANDIDATE_ID;
              const candidate = isMe ? null : getCandidateById(app.candidateId);
              const displayName = isMe
                ? "You (demo)"
                : candidate?.displayName ?? "Unknown candidate";

              return (
                <div
                  key={app.id}
                  className="rounded-2xl border border-border bg-card p-4 space-y-3"
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="size-9">
                      <AvatarFallback className="bg-primary/10 text-xs text-primary">
                        {initials(displayName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{displayName}</p>
                      <p className="text-xs text-muted-foreground">
                        Applied {timeAgo(app.appliedAt)}
                        {app.stakeId && " · Staked"}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <ApplicationStatusBadge status={app.status} />
                        <MatchScoreBadge score={app.matchScore} />
                      </div>
                    </div>
                    <Select
                      value={app.status}
                      onValueChange={(v) => {
                        updateStatus(app.id, v as ApplicationStatus);
                        toast.success("Status updated");
                      }}
                    >
                      <SelectTrigger className="w-36 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(
                          [
                            "APPLIED",
                            "REVIEWED",
                            "INTERVIEW",
                            "OFFERED",
                            "HIRED",
                            "REJECTED",
                          ] as ApplicationStatus[]
                        ).map((s) => (
                          <SelectItem key={s} value={s} className="text-xs">
                            {s.charAt(0) + s.slice(1).toLowerCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {app.message && (
                    <p className="rounded-lg bg-muted/40 p-3 text-sm leading-relaxed text-foreground/90">
                      {app.message}
                    </p>
                  )}

                  <ApplicationTimeline status={app.status} />
                </div>
              );
            })}
          </div>
        )}
      </section>

      <StakeDialog
        open={stakeOpen}
        onOpenChange={setStakeOpen}
        title="Stake to publish job"
        description={`Lock cUSD in escrow to activate "${job.title}".`}
        amount={10}
        adjustable
        min={5}
        max={100}
        refundPolicy="Refunded when the role closes without dispute."
        confirmLabel="Lock stake & activate"
        onConfirm={(amount) => {
          stakeForJob(job.id, amount, "cUSD");
          toast.success("Job activated!");
          setStakeOpen(false);
        }}
      />
    </div>
  );
}
