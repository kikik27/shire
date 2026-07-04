"use client";

import * as React from "react";
import { AlertCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { useAccessToken } from "@/lib/auth/use-access-token";
import { getProfile, ProfileNotFoundError } from "@/lib/profile-client";
import type { CandidateProfile } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AuthShell } from "@/components/layout/auth-shell";
import { CandidateCvUpload } from "@/components/profile/candidate-cv-upload";
import { CandidateProfileForm } from "@/components/profile/candidate-profile-form";

function CandidateOnboardingContent() {
  const accessToken = useAccessToken();
  const searchParams = useSearchParams();
  const [draft, setDraft] = React.useState<CandidateProfile | null>(null);
  const [initialProfile, setInitialProfile] = React.useState<CandidateProfile | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      setLoading(true);
      setError(null);
      try {
        const token = await accessToken();
        const profile = await getProfile<CandidateProfile>("candidate", token);
        if (!cancelled) setInitialProfile(profile);
      } catch (loadError) {
        if (cancelled) return;
        if (loadError instanceof ProfileNotFoundError) {
          setInitialProfile(null);
          return;
        }
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load your candidate profile.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const redirectTo = searchParams.get("next") === "/onboarding/recruiter"
    ? "/onboarding/recruiter"
    : "/candidate";

  return (
    <AuthShell back={{ href: "/onboarding", label: "Back" }} step="2 of 3">
      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <h1 className="text-xl font-semibold tracking-tight">Set up your candidate profile</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          The AI uses this to match you to roles and generate apply kits.
        </p>
        <div className="mt-6">
          {error ? (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle />
              <AlertTitle>Could not load profile</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {loading ? (
            <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
              Loading profile...
            </div>
          ) : (
            <div className="space-y-6">
              <CandidateCvUpload
                onDraft={setDraft}
                existingProfile={initialProfile}
              />
              <CandidateProfileForm
                redirectTo={redirectTo}
                draft={draft}
                initialProfile={initialProfile}
              />
            </div>
          )}
        </div>
      </div>
    </AuthShell>
  );
}

export default function OnboardingCandidatePage() {
  return (
    <React.Suspense
      fallback={
        <AuthShell back={{ href: "/onboarding", label: "Back" }} step="2 of 3">
          <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
            Loading profile...
          </div>
        </AuthShell>
      }
    >
      <CandidateOnboardingContent />
    </React.Suspense>
  );
}
