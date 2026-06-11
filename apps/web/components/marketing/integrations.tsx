import Link from "next/link";
import { Workflow } from "lucide-react";
import { Logo } from "@/components/site/logo";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/marketing/section-heading";
import { integrations } from "@/lib/marketing";

export function Integrations() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading
              eyebrow="Integrations"
              title="Fits the workflow you already have"
              description="Connect Shire to the tools your team lives in. Move from match to interview to settled offer without leaving your stack."
              align="left"
            />
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/dashboard">Start free trial</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="#features">Browse integrations</Link>
              </Button>
            </div>
          </div>

          {/* orbit of integration chips around the Shire mark */}
          <div className="relative mx-auto grid aspect-square w-full max-w-md place-items-center">
            <div
              aria-hidden="true"
              className="absolute inset-0 rounded-full border border-border"
            />
            <div
              aria-hidden="true"
              className="absolute inset-[14%] rounded-full border border-border"
            />
            <div
              aria-hidden="true"
              className="absolute inset-[28%] rounded-full border border-dashed border-border"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-[10%] rounded-full bg-primary/5 blur-2xl"
            />

            <div className="z-10 grid size-16 place-items-center rounded-2xl border border-border bg-card shadow-lg">
              <Logo showWord={false} className="[&_span]:size-10 [&_svg]:size-6" />
              <Workflow className="sr-only" aria-hidden="true" />
            </div>

            <ul className="absolute inset-0">
              {integrations.map((name, i) => {
                const angle = (i / integrations.length) * 2 * Math.PI - Math.PI / 2;
                const radius = 46; // % from center
                const left = 50 + radius * Math.cos(angle);
                const top = 50 + radius * Math.sin(angle);
                return (
                  <li
                    key={name}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${left}%`, top: `${top}%` }}
                  >
                    <span className="grid size-12 place-items-center rounded-xl border border-border bg-card text-[11px] font-semibold text-muted-foreground shadow-sm">
                      {name.slice(0, 2)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
