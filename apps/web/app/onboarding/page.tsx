"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Sparkles, Users } from "lucide-react";
import { useAccessToken } from "@/lib/auth/use-access-token";
import {
  getActiveRoleState,
  onboardingChoiceDestination,
  postOnboardingDestination,
} from "@/lib/role-client";
import { AuthShell } from "@/components/layout/auth-shell";
import { cn } from "@/lib/utils";

const roles = [
  {
    id: "candidate",
    icon: Sparkles,
    label: "Find Jobs",
    description: "AI matches you to verified, stake-backed roles. No spam recruiters.",
  },
  {
    id: "recruiter",
    icon: Briefcase,
    label: "Find Talent",
    description: "Post stake-backed jobs and let AI surface the best-fit candidates.",
  },
  {
    id: "both",
    icon: Users,
    label: "Both",
    description: "Switch between hiring and applying with one Shire account.",
  },
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const accessToken = useAccessToken();
  const [checkingRoles, setCheckingRoles] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    async function redirectIfOnboarded() {
      setCheckingRoles(true);
      try {
        const token = await accessToken();
        const activeRoles = await getActiveRoleState(token);
        const destination = postOnboardingDestination(activeRoles);
        if (!cancelled && destination) {
          router.replace(destination);
        }
      } catch {
        if (!cancelled) {
          setCheckingRoles(false);
        }
        return;
      }
      if (!cancelled) {
        setCheckingRoles(false);
      }
    }

    void redirectIfOnboarded();
    return () => {
      cancelled = true;
    };
  }, [accessToken, router]);

  if (checkingRoles) {
    return (
      <AuthShell back={{ href: "/connect", label: "Back" }} step="1 of 3">
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Checking your account...
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell back={{ href: "/connect", label: "Back" }} step="1 of 3">
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">How will you use Shire?</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Choose a profile to create. A role becomes active only after the profile is saved.
          </p>
        </div>

        <ul className="space-y-3">
          {roles.map(({ id, icon: Icon, label, description }) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => router.push(onboardingChoiceDestination(id))}
                className={cn(
                  "w-full rounded-2xl border border-border bg-card p-4 text-left transition-[border-color,box-shadow] hover:border-primary/50 hover:shadow-sm",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                <div className="flex items-start gap-4">
                  <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{label}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>

        <p className="text-center text-xs text-muted-foreground">
          Celo registration stays separate from profile activation.
        </p>
      </div>
    </AuthShell>
  );
}
