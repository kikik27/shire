"use client";

import Link from "next/link";
import { Zap } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

export default function RecruiterStakesPage() {
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Stake history"
        description="Escrow records for your job postings."
      />

      <EmptyState
        icon={Zap}
        title="No stake history"
        description="Escrow records from your job postings will appear here when stake activity is available."
        action={
          <Button asChild size="sm">
            <Link href="/recruiter/jobs">View jobs</Link>
          </Button>
        }
      />
    </div>
  );
}
