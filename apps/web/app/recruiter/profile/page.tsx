"use client";

import { PageHeader } from "@/components/shared/page-header";
import { RecruiterProfileForm } from "@/components/profile/recruiter-profile-form";

export default function RecruiterProfilePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Company profile"
        description="Verified companies attract better candidates and earn higher trust scores."
      />
      <div className="rounded-2xl border border-border bg-card p-6">
        <RecruiterProfileForm />
      </div>
    </div>
  );
}
