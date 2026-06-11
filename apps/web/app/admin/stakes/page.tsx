"use client";

import { PageHeader } from "@/components/shared/page-header";
import { AdminStakeTable } from "@/components/admin/admin-stake-table";

export default function AdminStakesPage() {
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Stake management"
        description="Refund or slash any locked escrow stake."
      />
      <AdminStakeTable />
    </div>
  );
}
