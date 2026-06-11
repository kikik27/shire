import { ArrowRight } from "lucide-react";
import { SectionHeading } from "@/components/marketing/section-heading";
import { steps } from "@/lib/marketing";

export function Steps() {
  return (
    <section id="how-it-works" className="scroll-mt-20 bg-card">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <SectionHeading
          eyebrow="How it works"
          title="Get started in 3 simple steps"
          description="From upload to settled offer — Shire keeps every step structured, fast, and yours to approve."
        />

        <div className="relative mt-14 grid gap-6 md:grid-cols-3">
          {steps.map((step, i) => (
            <div
              key={step.num}
              className="group relative rounded-2xl border border-border bg-background p-6 transition-shadow duration-200 hover:shadow-lg sm:p-8"
            >
              <span className="font-mono text-5xl font-semibold tabular-nums text-primary/15 transition-colors duration-200 group-hover:text-primary/30">
                {step.num}
              </span>
              <h3 className="mt-4 text-lg font-semibold tracking-tight">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>

              {i < steps.length - 1 && (
                <ArrowRight
                  aria-hidden="true"
                  className="absolute -right-3 top-1/2 hidden size-6 -translate-y-1/2 text-border md:block"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
