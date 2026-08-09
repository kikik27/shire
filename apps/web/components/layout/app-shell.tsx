"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import type { AppRole, CandidateProfile, RecruiterProfile } from "@/lib/types";
import { getProfile } from "@/lib/profile-client";
import { useAccessToken } from "@/lib/auth/use-access-token";
import { Logo } from "@/components/site/logo";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import { RoleSwitcher } from "@/components/layout/role-switcher";
import { WalletConnectButton } from "@/components/wallet/wallet-connect-button";
import { navConfig, roleMeta } from "@/components/layout/app-nav";
import { cn } from "@/lib/utils";

function useAccountLabel(role: AppRole) {
  const accessToken = useAccessToken();
  const [label, setLabel] = React.useState(roleMeta[role].label);

  React.useEffect(() => {
    let cancelled = false;

    async function loadLabel() {
      if (role === "admin") {
        setLabel("Admin");
        return;
      }

      try {
        const token = await accessToken();
        if (role === "candidate") {
          const profile = await getProfile<CandidateProfile>("candidate", token);
          // null = not onboarded yet — fall back to the generic role label.
          if (!cancelled && profile) setLabel(profile.displayName);
        } else {
          const profile = await getProfile<RecruiterProfile>("recruiter", token);
          if (!cancelled && profile) setLabel(profile.companyName);
        }
      } catch {
        if (!cancelled) setLabel(roleMeta[role].label);
      }
    }

    void loadLabel();
    return () => {
      cancelled = true;
    };
  }, [accessToken, role]);

  return label;
}

export function AppShell({ role, children }: { role: AppRole; children: React.ReactNode }) {
  const pathname = usePathname();
  const items = navConfig[role];
  const accountLabel = useAccountLabel(role);

  const isActive = (href: string) =>
    href === roleMeta[role].home ? pathname === href : pathname.startsWith(href);

  return (
    <div className="min-h-dvh bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="flex h-16 items-center border-b border-sidebar-border px-5">
          <Link
            href="/"
            className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          >
            <Logo />
          </Link>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {items.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                  active
                    ? "bg-sidebar-primary/10 text-sidebar-primary"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <RoleSwitcher current={role} />
        </div>
      </aside>

      <div className="lg:pl-64">
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-md sm:px-6">
          <div className="lg:hidden">
            <Link
              href="/"
              className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Logo showWord={false} />
            </Link>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <div className="lg:hidden">
              <RoleSwitcher current={role} />
            </div>
            <ThemeToggle />
            <WalletConnectButton
              size="sm"
              accountLabel={accountLabel}
              accountDescription={roleMeta[role].label}
            />
          </div>
        </header>

        <main className="px-4 pb-24 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pb-12">
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      >
        <ul className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
          {items.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-[56px] flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-5" aria-hidden="true" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
