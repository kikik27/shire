"use client";

import { PageHeader } from "@/components/shared/page-header";
import { AdminJobTable } from "@/components/admin/admin-job-table";

export default function AdminJobsPage() {
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Job moderation"
        description="Review, approve, flag, or close any listing."
      />
      <AdminJobTable />
    </div>
  );
}
