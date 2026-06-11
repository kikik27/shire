"use client";

import { PageHeader } from "@/components/shared/page-header";
import { DisputeReviewPanel } from "@/components/admin/dispute-review-panel";

export default function AdminDisputesPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Dispute review"
        description="Resolve open disputes — slash or refund staked funds."
      />
      <DisputeReviewPanel />
    </div>
  );
}
