import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { HeroPrompt } from "@/components/marketing/hero-prompt";
import { HeroBeams } from "@/components/marketing/hero-beams";
import { heroChips } from "@/lib/marketing";

const avatars = ["AO", "SL", "PN", "DK"];

export function Hero() {
  return (
    <section className="dark relative overflow-hidden bg-background text-foreground">
      {/* ambient brand glow + grid */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-grid mask-fade-b opacity-60"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 size-[44rem] -translate-x-1/2 rounded-full bg-primary/25 blur-[120px]"
      />
      <HeroBeams />

      <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 sm:pt-20 lg:px-8 lg:pb-28">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <Link
            href="#features"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-foreground/80 backdrop-blur transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ShieldCheck className="size-3.5 text-primary" aria-hidden="true" />
            Stablecoin escrow on Celo, built in
          </Link>

          <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            Your AI copilot for hiring{" "}
            <span className="text-primary">and getting hired</span>.
          </h1>

          <p className="mt-5 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">
            Shire finds the jobs and the talent. You approve the important moves. Stablecoin
            escrow on Celo protects both sides — start to settled.
          </p>

          <div className="mt-8 w-full">
            <HeroPrompt />
          </div>

          {/* suggested searches */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs text-muted-foreground">Popular:</span>
            {heroChips.map((chip) => (
              <Link
                key={chip}
                href="/dashboard"
                className="rounded-full border border-white/12 bg-white/[0.03] px-3 py-1 text-xs text-foreground/80 transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {chip}
              </Link>
            ))}
          </div>

          {/* trust cluster */}
          <div className="mt-10 flex items-center gap-3">
            <div className="flex -space-x-2">
              {avatars.map((a) => (
                <Avatar key={a} className="size-8 border-2 border-background">
                  <AvatarFallback className="bg-primary/15 text-[11px] font-medium text-foreground">
                    {a}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              Trusted by <span className="font-medium text-foreground">1,000+</span> teams and
              candidates
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/dashboard">Get started — it&apos;s free</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white/20 bg-white/5">
              <Link href="#how-it-works">See how it works</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
