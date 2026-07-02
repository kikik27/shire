"use client";

import Link from "next/link";
import { usePlatformStakes } from "@/lib/hooks/use-stakes";
import { PageHeader } from "@/components/shared/page-header";
import { PlatformStakeHistory } from "@/components/stake/platform-stake-history";
import { Button } from "@/components/ui/button";

export default function RecruiterStakesPage() {
  const {
    data: stakes = [],
    isLoading,
    isError,
    isFetching,
    refetch,
  } = usePlatformStakes();
  const jobStakes = stakes.filter((stake) => stake.type === "JOB_POST");

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Stake history"
        description="Platform escrow history for your job postings."
      />

      <PlatformStakeHistory
        stakes={jobStakes}
        isLoading={isLoading}
        error={isError}
        isFetching={isFetching}
        onRetry={() => void refetch()}
        emptyAction={
          <Button asChild size="sm">
            <Link href="/recruiter/jobs">View jobs</Link>
          </Button>
        }
      />
    </div>
  );
}
