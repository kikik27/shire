import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Cta() {
  return (
    <section className="bg-background">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="relative overflow-hidden rounded-[2rem] border border-border bg-card px-6 py-16 text-center shadow-sm sm:px-12 lg:py-24">
          {/* layered warm glow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 left-1/2 size-[40rem] -translate-x-1/2 rounded-full bg-primary/30 blur-[130px]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-[-30%] right-[-5%] size-[26rem] rounded-full bg-chart-3/15 blur-[120px]"
          />
          <div className="relative mx-auto max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl lg:text-5xl">
              Land your next role, or your next hire
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">
              Smarter matches, real commitment, and escrow that protects both sides. Join Shire
              and let the AI do the finding.
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/connect">
                  Get started free
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="#stake">See how staking works</Link>
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
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
          </div>
        </div>
      </div>
    </section>
  );
}
