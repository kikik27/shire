"use client";

import Link from "next/link";
import { Zap } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

export default function CandidateStakesPage() {
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="My stakes"
        description="Escrow history for your applications."
      />

      <EmptyState
        icon={Zap}
        title="No stake history"
        description="Escrow records from your applications will appear here when stake activity is available."
        action={
          <Button asChild size="sm">
            <Link href="/candidate/applications">View applications</Link>
          </Button>
        }
      />
    </div>
  );
}
