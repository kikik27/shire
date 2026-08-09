"use client";

import * as React from "react";
import { AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";

import { useAccessToken } from "@/lib/auth/use-access-token";
import { getProfile, ProfileUnauthorizedError } from "@/lib/profile-client";
import type { RecruiterProfile } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AuthShell } from "@/components/layout/auth-shell";
import { RecruiterProfileForm } from "@/components/profile/recruiter-profile-form";

export default function OnboardingRecruiterPage() {
  const accessToken = useAccessToken();
  const router = useRouter();
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
        // null = not onboarded yet → render the empty form. Not an error.
        const profile = await getProfile<RecruiterProfile>("recruiter", token);
        if (!cancelled) setInitialProfile(profile);
      } catch (loadError) {
        if (cancelled) return;
        if (loadError instanceof ProfileUnauthorizedError) {
          // Session expired/missing — send back to sign-in rather than stranding
          // the user on a page whose every API call 401s.
          router.replace("/connect");
          return;
        }
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
    <AuthShell back={{ href: "/onboarding", label: "Back" }} step="2 of 3">
      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <h1 className="text-xl font-semibold tracking-tight">Set up your company profile</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Verified companies get higher trust scores and attract better candidates.
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
            <RecruiterProfileForm
              redirectTo="/recruiter"
              initialProfile={initialProfile}
            />
          )}
        </div>
      </div>
    </AuthShell>
  );
}
