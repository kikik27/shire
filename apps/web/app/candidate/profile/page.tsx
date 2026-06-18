"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";

import { useAccessToken } from "@/lib/auth/use-access-token";
import { PRIVY_ENABLED } from "@/lib/auth/use-auth";
import { getProfile, ProfileNotFoundError } from "@/lib/profile-client";
import type { CandidateProfile } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageHeader } from "@/components/shared/page-header";
import { CandidateCvUpload } from "@/components/profile/candidate-cv-upload";
import { CandidateProfileForm } from "@/components/profile/candidate-profile-form";

export default function CandidateProfilePage() {
  const router = useRouter();
  const accessToken = useAccessToken();
  const [draft, setDraft] = React.useState<CandidateProfile | null>(null);
  const [initialProfile, setInitialProfile] = React.useState<CandidateProfile | null>(null);
  const [loading, setLoading] = React.useState(PRIVY_ENABLED);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!PRIVY_ENABLED) return;

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
          router.replace("/onboarding/candidate");
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
  }, [accessToken, router]);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Candidate profile"
        description="Keep this up to date for better AI match scores."
      />
      {error ? (
        <Alert variant="destructive">
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
        <>
          <CandidateCvUpload onDraft={setDraft} />
          <div className="rounded-2xl border border-border bg-card p-6">
            <CandidateProfileForm draft={draft} initialProfile={initialProfile} />
          </div>
        </>
      )}
    </div>
  );
}
