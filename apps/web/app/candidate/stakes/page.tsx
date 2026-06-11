"use client";

import { Zap } from "lucide-react";
import { useCandidateStakes } from "@/lib/selectors";
import { useShireStore } from "@/lib/store";
import { PageHeader } from "@/components/shared/page-header";
import { StakeHistoryCard } from "@/components/stake/stake-history-card";
import { EmptyState } from "@/components/shared/empty-state";

export default function CandidateStakesPage() {
  const stakes = useCandidateStakes();
  const jobs = useShireStore((s) => s.jobs);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="My stakes"
        description="Escrow history for your applications."
      />

      {stakes.length === 0 ? (
        <EmptyState
          icon={Zap}
          title="No stake history"
          description="Stakes appear here when you apply with escrow backing."
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
