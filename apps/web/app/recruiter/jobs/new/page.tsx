"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { JobDraftForm } from "@/components/jobs/job-draft-form";
import { StakeDialog } from "@/components/stake/stake-dialog";
import { PageHeader } from "@/components/shared/page-header";
import type { Job } from "@/lib/types";
import type { JobDraftValues } from "@/lib/schemas";
import { useCreateJob, usePublishJob } from "@/lib/hooks/use-jobs";

export default function NewJobPage() {
  const router = useRouter();
  const createJob = useCreateJob();
  const publishJob = usePublishJob();
  const [draft, setDraft] = useState<Job | null>(null);
  const [stakeOpen, setStakeOpen] = useState(false);

  function handleFormSubmit(values: JobDraftValues) {
    createJob.mutate(values, {
      onSuccess: (job) => {
        setDraft(job);
        setStakeOpen(true);
      },
      onError: () => {
        toast.error("Job could not be saved.");
      },
    });
  }

  function handleStakeConfirm(amount: number) {
    if (!draft) return;
    publishJob.mutate(draft.id, {
      onSuccess: () => {
        toast.success("Job posted with simulated stake.", {
          description: `${draft.title} is live with a ${amount} cUSD simulated stake.`,
        });
        router.push(`/recruiter/jobs/${draft.id}`);
      },
      onError: () => {
        toast.error("Job was saved, but activation failed.");
      },
    });
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Post a new job"
        description="Stake cUSD to activate the listing: no stake, no spam."
      />

      <div className="rounded-2xl border border-border bg-card p-6">
        <JobDraftForm
          isSubmitting={createJob.isPending}
          onSubmit={handleFormSubmit}
        />
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
