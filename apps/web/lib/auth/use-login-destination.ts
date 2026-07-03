"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { getActiveRoleState, postOnboardingDestination } from "@/lib/role-client";
import { useAccessToken } from "@/lib/auth/use-access-token";

/**
 * Resolves where a freshly-signed-in user should land.
 *
 * - Returning users with an existing profile go straight to their role dashboard
 *   (`/candidate` or `/recruiter`).
 * - Brand-new users with no profile yet are sent to `/onboarding`.
 *
 * Any failure falls back to `/onboarding` so the user is never stranded.
 */
export function useLoginDestination() {
  const router = useRouter();
  const accessToken = useAccessToken();

  const resolveDestination = React.useCallback(async (): Promise<string> => {
    try {
      const token = await accessToken();
      const activeRoles = await getActiveRoleState(token);
      return postOnboardingDestination(activeRoles) ?? "/onboarding";
    } catch {
      return "/onboarding";
    }
  }, [accessToken]);

  /** Resolve the destination and navigate to it. */
  const goToLoginDestination = React.useCallback(
    (method: "push" | "replace" = "push") => {
      let cancelled = false;
      void resolveDestination().then((destination) => {
        if (cancelled) return;
        router[method](destination);
      });
      return () => {
        cancelled = true;
      };
    },
    [resolveDestination, router],
  );

  return { resolveDestination, goToLoginDestination };
}
