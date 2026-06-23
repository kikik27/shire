import { SectionHeading } from "@/components/marketing/section-heading";
import { MatchBar } from "@/components/marketing/match-bar";
import { Reveal } from "@/components/marketing/reveal";
import { features } from "@/lib/marketing";

export function Features() {
  return (
    <section id="features" className="scroll-mt-20">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <SectionHeading
          eyebrow="Features"
          title="Everything to match, apply, and settle"
          description="Built around one idea: real commitment from both sides, with the AI doing the finding and you keeping the final say."
        />

        {/* Editorial grid: numbered eyebrow + title + line, hover-revealed accent bar. */}
        <ul className="mx-auto mt-16 grid max-w-5xl gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <Reveal as="li" key={feature.title} delay={(i % 3) * 0.08} className="group relative">
              <span className="absolute left-0 top-0 h-full w-px bg-transparent transition-colors duration-300 group-hover:bg-primary" aria-hidden="true" />
              <div className="border-t border-border pt-5 transition-[border-color] duration-300 group-hover:border-primary/40">
                <span className="font-mono text-xs text-primary/70" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-2 text-base font-semibold tracking-tight">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {feature.body}
                </p>
                {feature.match && <MatchBar score={feature.match.score} skills={feature.match.skills} />}
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
