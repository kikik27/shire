"use client";

import { Zap } from "lucide-react";
import { useRecruiterStakes } from "@/lib/selectors";
import { useShireStore } from "@/lib/store";
import { PageHeader } from "@/components/shared/page-header";
import { StakeHistoryCard } from "@/components/stake/stake-history-card";
import { EmptyState } from "@/components/shared/empty-state";

export default function RecruiterStakesPage() {
  const stakes = useRecruiterStakes();
  const jobs = useShireStore((s) => s.jobs);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Stake history"
        description="Escrow records for your job postings."
      />

      {stakes.length === 0 ? (
        <EmptyState
          icon={Zap}
          title="No stake history"
          description="Stake a job to start — records appear here."
        />
      ) : (
        <div className="space-y-2">
          {stakes.map((stake) => {
            const job = jobs.find((j) => j.id === stake.jobId);
            return (
              <StakeHistoryCard key={stake.id} stake={stake} jobTitle={job?.title} />
            );
          })}
        </div>
      )}
    </div>
  );
}
