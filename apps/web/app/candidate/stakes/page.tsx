"use client";

import Link from "next/link";
import { usePlatformStakes } from "@/lib/hooks/use-stakes";
import { PageHeader } from "@/components/shared/page-header";
import { PlatformStakeHistory } from "@/components/stake/platform-stake-history";
import { Button } from "@/components/ui/button";

export default function CandidateStakesPage() {
  const {
    data: stakes = [],
    isLoading,
    isError,
    isFetching,
    refetch,
  } = usePlatformStakes();
  const applicationStakes = stakes.filter(
    (stake) => stake.type === "APPLICATION",
  );

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="My stakes"
        description="Platform escrow history for your applications."
      />

      <PlatformStakeHistory
        stakes={applicationStakes}
        isLoading={isLoading}
        error={isError}
        isFetching={isFetching}
        onRetry={() => void refetch()}
        emptyAction={
          <Button asChild size="sm">
            <Link href="/candidate/applications">View applications</Link>
          </Button>
        }
      />
    </div>
  );
}
