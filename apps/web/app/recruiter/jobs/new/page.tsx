"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useShireStore } from "@/lib/store";
import { JobDraftForm } from "@/components/jobs/job-draft-form";
import { StakeDialog } from "@/components/stake/stake-dialog";
import { PageHeader } from "@/components/shared/page-header";
import type { Job } from "@/lib/types";
import type { JobDraftValues } from "@/lib/schemas";

export default function NewJobPage() {
  const router = useRouter();
  const createJob = useShireStore((s) => s.createJob);
  const stakeForJob = useShireStore((s) => s.stakeForJob);
  const [draft, setDraft] = useState<Job | null>(null);
  const [stakeOpen, setStakeOpen] = useState(false);

  function handleFormSubmit(values: JobDraftValues) {
    const job = createJob(values);
    setDraft(job);
    setStakeOpen(true);
  }

  function handleStakeConfirm(amount: number) {
    if (!draft) return;
    stakeForJob(draft.id, amount, "cUSD");
    toast.success("Job posted and staked!", {
      description: `${draft.title} is now live and attracting candidates.`,
    });
    router.push(`/recruiter/jobs/${draft.id}`);
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Post a new job"
        description="Stake cUSD to activate the listing — no stake, no spam."
      />

      <div className="rounded-2xl border border-border bg-card p-6">
        <JobDraftForm onSubmit={handleFormSubmit} />
      </div>

      {draft && (
        <StakeDialog
          open={stakeOpen}
          onOpenChange={setStakeOpen}
          title="Stake to activate your job"
          description={`Lock cUSD in escrow to publish "${draft.title}". Refunded when the role closes without a valid dispute.`}
          amount={10}
          adjustable
          min={5}
          max={100}
          refundPolicy="Refunded when the role closes without dispute."
          confirmLabel="Lock stake & post job"
          onConfirm={handleStakeConfirm}
        />
      )}
    </div>
  );
}
