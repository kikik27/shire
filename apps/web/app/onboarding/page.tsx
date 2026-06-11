"use client";

import { useRouter } from "next/navigation";
import { Briefcase, Sparkles, Users } from "lucide-react";
import { useShireStore } from "@/lib/store";
import { AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RoleType } from "@/lib/types";

const roles = [
  {
    roleType: 1 as RoleType,
    icon: Sparkles,
    label: "Find Jobs",
    description: "AI matches you to verified, stake-backed roles. No spam recruiters.",
    href: "/onboarding/candidate",
  },
  {
    roleType: 2 as RoleType,
    icon: Briefcase,
    label: "Find Talent",
    description: "Post stake-backed jobs and let AI surface the best-fit candidates.",
    href: "/onboarding/recruiter",
  },
  {
    roleType: 3 as RoleType,
    icon: Users,
    label: "Both",
    description: "Switch between hiring and applying with one wallet identity.",
    href: "/onboarding/candidate",
  },
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const registerUser = useShireStore((s) => s.registerUser);
  const registeredOnchain = useShireStore((s) => s.registeredOnchain);

  function choose(roleType: RoleType, href: string) {
    registerUser(roleType);
    router.push(href);
  }

  return (
    <AuthShell back={{ href: "/connect", label: "Back" }} step="1 of 3">
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">How will you use Shire?</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            This registers your wallet on Celo — you can always add the other role later.
          </p>
        </div>

        <ul className="space-y-3">
          {roles.map(({ roleType, icon: Icon, label, description, href }) => (
            <li key={roleType}>
              <button
                type="button"
                onClick={() => choose(roleType, href)}
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

        {registeredOnchain && (
          <p className="text-center text-xs text-muted-foreground">
            Already registered — choose a role to update or continue setup.
          </p>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Simulated onchain registration — Celo Alfajores.
        </p>
      </div>
    </AuthShell>
  );
}
