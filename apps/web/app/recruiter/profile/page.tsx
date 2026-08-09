"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";

import { useAccessToken } from "@/lib/auth/use-access-token";
import { getProfile } from "@/lib/profile-client";
import type { RecruiterProfile } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageHeader } from "@/components/shared/page-header";
import { RecruiterProfileForm } from "@/components/profile/recruiter-profile-form";

export default function RecruiterProfilePage() {
  const router = useRouter();
  const accessToken = useAccessToken();
  const [initialProfile, setInitialProfile] = React.useState<RecruiterProfile | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      setLoading(true);
      setError(null);
      try {
        const token = await accessToken();
        const profile = await getProfile<RecruiterProfile>("recruiter", token);
        if (cancelled) return;
        // null = not onboarded yet → send to onboarding instead of rendering an
        // empty edit form outside the guided flow.
        if (profile === null) {
          router.replace("/onboarding/recruiter");
          return;
        }
        setInitialProfile(profile);
      } catch (loadError) {
        if (cancelled) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load your company profile.",
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
        title="Company profile"
        description="Verified companies attract better candidates and earn higher trust scores."
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
        <div className="rounded-2xl border border-border bg-card p-6">
          <RecruiterProfileForm initialProfile={initialProfile} />
        </div>
      )}
    </div>
  );
}
