"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroPrompt } from "@/components/marketing/hero-prompt";
import { Parallax, Reveal } from "@/components/marketing/reveal";
import { heroSteps } from "@/lib/marketing";
import { cn } from "@/lib/utils";

export function Hero() {
  // Steps light up in sequence for the "show the workflow" beat.
  const [active, setActive] = React.useState(0);

  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return;
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % heroSteps.length);
    }, 2200);
    return () => window.clearInterval(id);
  }, []);

  return (
    <section className="relative overflow-hidden bg-background text-foreground">
      {/* layered ambient: warm mesh glow + soft grid */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-grid mask-fade-b opacity-40"
      />
      <Parallax
        range={36}
        className="pointer-events-none absolute -top-48 left-1/2 size-[48rem] -translate-x-1/2 rounded-full bg-primary/25 blur-[140px]"
      >
        <div className="size-full rounded-full" />
      </Parallax>
      <Parallax
        range={-28}
        className="pointer-events-none absolute right-[-10%] top-1/3 size-[28rem] rounded-full bg-chart-3/15 blur-[120px]"
      >
        <div className="size-full rounded-full" />
      </Parallax>

      <div className="relative mx-auto max-w-7xl px-4 pb-24 pt-20 sm:px-6 sm:pt-24 lg:px-8 lg:pb-32">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <Reveal mount>
            <Link
              href="#features"
              className="group inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3.5 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60" />
                <span className="relative inline-flex size-2 rounded-full bg-primary" />
              </span>
              Escrow-backed hiring
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </Reveal>

          <Reveal mount delay={0.08}>
            <h1 className="mt-7 text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              Hiring where both sides actually{" "}
              <span className="relative whitespace-nowrap text-primary">
                commit
                <svg
                  aria-hidden="true"
                  viewBox="0 0 200 12"
                  preserveAspectRatio="none"
                  className="absolute -bottom-1.5 left-0 h-2 w-full text-primary/40"
                >
                  <path d="M2 9C40 3 160 3 198 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" />
                </svg>
              </span>
              .
            </h1>
          </Reveal>

          <Reveal mount delay={0.16}>
            <p className="mt-6 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">
              Ghosted candidates. No-show hires. Weeks of wasted screening. Shire backs every match
              with a refundable stake, so the commitment is real on both sides.
            </p>
          </Reveal>

          <Reveal mount delay={0.24} className="mt-9 w-full">
            {/* the search box stays because it&apos;s step 1 of the story */}
            <HeroPrompt />
          </Reveal>

          <Reveal mount delay={0.32}>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="shadow-sm">
                <Link href="/connect">
                  Get started. It&apos;s free
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="#how-it-works">See how it works</Link>
              </Button>
            </div>
          </Reveal>

          <Reveal mount delay={0.4}>
            {/* trust chips */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
              {["No crypto setup", "Free to join", "Stake refunded on success"].map((chip) => (
                <span
                  key={chip}
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"
                >
                  <Check className="size-3.5 text-primary" aria-hidden="true" />
                  {chip}
                </span>
              ))}
            </div>
          </Reveal>
        </div>

        {/* the story: a 3-beat workflow that animates in sequence */}
        <div className="mx-auto mt-20 max-w-4xl">
          <ol className="grid gap-4 sm:grid-cols-3">
            {heroSteps.map((step, i) => (
              <Reveal
                as="li"
                key={step.id}
                delay={i * 0.1}
                className={cn("hero-step", i === active && "is-active")}
              >
                <div className="hero-step-card rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition-[border-color,box-shadow] duration-500">
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-7 place-items-center rounded-full bg-primary/10 font-mono text-sm font-semibold text-primary">
                      {step.num}
                    </span>
                    <span className="text-sm font-semibold">{step.title}</span>
                    {i === active && (
                      <span className="ml-auto size-1.5 rounded-full bg-success" aria-hidden="true" />
                    )}
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{step.detail}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
