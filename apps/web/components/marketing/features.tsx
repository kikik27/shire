import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BellRing,
  FileText,
  LayoutGrid,
  type LucideIcon,
  MessageSquare,
  Scale,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { SectionHeading } from "@/components/marketing/section-heading";
import { features, type FeatureIcon } from "@/lib/marketing";

const iconMap: Record<FeatureIcon, LucideIcon> = {
  LayoutGrid,
  Sparkles,
  FileText,
  Users,
  Activity,
  ShieldCheck,
  Scale,
  MessageSquare,
  BellRing,
};

export function Features() {
  return (
    <section id="features" className="scroll-mt-20">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <SectionHeading
          eyebrow="Features"
          title="AI-powered hiring, end to end"
          description="Everything you need to match, apply, and settle — with the AI doing the finding and you keeping the final say."
        />

        <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = iconMap[feature.icon];
            return (
              <li key={feature.title}>
                <div className="group h-full rounded-2xl border border-border bg-card p-6 transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-lg">
                  <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15 transition-colors duration-200 group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-base font-semibold tracking-tight">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {feature.body}
                  </p>
                  <Link
                    href="#"
                    className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary transition-opacity duration-150 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:opacity-0 md:group-hover:opacity-100"
                  >
                    Learn more
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
