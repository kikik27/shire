import { SectionHeading } from "@/components/marketing/section-heading";
import { Counter, Reveal } from "@/components/marketing/reveal";
import { metrics } from "@/lib/marketing";

export function Metrics() {
  return (
    <section id="outcomes" className="scroll-mt-20 border-y border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <SectionHeading
          eyebrow="Outcomes"
          title="What changes when commitment is on the line"
          description="A refundable stake isn't a cost. It's a forcing function for the behavior you actually want."
        />
        <dl className="mx-auto mt-14 grid max-w-4xl grid-cols-1 gap-10 text-center sm:grid-cols-3">
          {metrics.map((metric, i) => (
            <Reveal key={metric.label} delay={i * 0.12} className="flex flex-col items-center">
              <dd className="bg-gradient-to-br from-primary to-primary/50 bg-clip-text font-mono text-6xl font-semibold tracking-tight tabular-nums text-transparent sm:text-7xl">
                <Counter value={metric.value} />
              </dd>
              <dt className="mt-4 max-w-[16rem] text-sm text-muted-foreground">
                {metric.label}
              </dt>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  );
}
