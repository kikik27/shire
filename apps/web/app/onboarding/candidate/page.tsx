"use client";

import { AuthShell } from "@/components/layout/auth-shell";
import { CandidateProfileForm } from "@/components/profile/candidate-profile-form";

export default function OnboardingCandidatePage() {
  return (
    <AuthShell back={{ href: "/onboarding", label: "Back" }} step="2 of 3">
      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <h1 className="text-xl font-semibold tracking-tight">Set up your candidate profile</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          The AI uses this to match you to roles and generate apply kits.
        </p>
        <div className="mt-6">
          <CandidateProfileForm redirectTo="/candidate" />
        </div>
      </div>
    </AuthShell>
  );
}
