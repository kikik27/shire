"use client";

import { PageHeader } from "@/components/shared/page-header";
import { CandidateProfileForm } from "@/components/profile/candidate-profile-form";

export default function CandidateProfilePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Candidate profile"
        description="Keep this up to date for better AI match scores."
      />
      <div className="rounded-2xl border border-border bg-card p-6">
        <CandidateProfileForm />
      </div>
    </div>
  );
}
