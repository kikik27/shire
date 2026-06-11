"use client";

import { AuthShell } from "@/components/layout/auth-shell";
import { RecruiterProfileForm } from "@/components/profile/recruiter-profile-form";

export default function OnboardingRecruiterPage() {
  return (
    <AuthShell back={{ href: "/onboarding", label: "Back" }} step="2 of 3">
      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <h1 className="text-xl font-semibold tracking-tight">Set up your company profile</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Verified companies get higher trust scores and attract better candidates.
        </p>
        <div className="mt-6">
          <RecruiterProfileForm redirectTo="/recruiter" />
        </div>
      </div>
    </AuthShell>
  );
}
