import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/site/logo";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";

export function AuthShell({
  children,
  back,
  step,
}: {
  children: React.ReactNode;
  back?: { href: string; label: string };
  step?: string;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="flex h-16 items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Logo />
        </Link>
        <div className="flex items-center gap-3">
          {step && <span className="text-sm text-muted-foreground">{step}</span>}
          <ThemeToggle />
        </div>
      </header>

      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-6 sm:items-center sm:pt-0">
        <div className="w-full max-w-md">
          {back && (
            <Link
              href={back.href}
              className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              {back.label}
            </Link>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
