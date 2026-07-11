import Link from "next/link";
import { RefreshCw, ShieldCheck, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/marketing/reveal";
import { SpotlightCard } from "@/components/marketing/spotlight-card";
import { StakeCalculator } from "@/components/marketing/stake-calculator";
import { SectionHeading } from "@/components/marketing/section-heading";

const points = [
  {
    icon: UserCircle,
    title: "Free to join",
    body: "Build your AI profile, browse roles, and get matched without paying a cent.",
  },
  {
    icon: ShieldCheck,
    title: "You only ever stake",
    body: "No monthly fee. The only money in play is a stake locked in escrow, never a payment to us.",
  },
  {
    icon: RefreshCw,
    title: "Refunded on success",
    body: "The stake releases back the moment both sides confirm. It's a commitment, not a cost.",
  },
];

export function StakeModel() {
  return (
    <section id="stake" className="scroll-mt-20 bg-card">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <SectionHeading
          eyebrow="No pricing, just stake"
          title="You don't pay to use Shire. You stake."
          description="There's no subscription and no platform fee. Both sides lock a small, refundable stake in escrow. It signals real commitment and comes straight back when the hire works out."
        />

        <div className="mx-auto mt-16 grid max-w-5xl gap-6 md:grid-cols-3">
          {points.map((point, i) => (
            <Reveal key={point.title} delay={i * 0.12}>
              <div className="group overflow-hidden rounded-2xl border border-border bg-background shadow-sm transition-[box-shadow,transform] duration-200 hover:-translate-y-1 hover:shadow-lg">
                <SpotlightCard className="flex h-full flex-col p-7">
                  <span className="grid size-12 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15 transition-colors duration-200 group-hover:bg-primary group-hover:text-primary-foreground">
                    <point.icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 font-semibold tracking-tight">{point.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{point.body}</p>
                </SpotlightCard>
              </div>
            </Reveal>
          ))}
        </div>

        <StakeCalculator />

        <Reveal>
          <div className="mx-auto mt-8 flex max-w-5xl flex-col gap-4 rounded-2xl border border-border bg-background p-7 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <p className="text-sm text-foreground/90">
              <span className="font-medium">New to crypto? You don&apos;t need to be.</span>{" "}
              Sign in with email or Google and Shire sets up your account. Stakes show in
              USD-pegged XLM and never leave escrow until you both confirm.
            </p>
          </div>
          <Button asChild size="sm" variant="outline" className="shrink-0">
            <Link href="#faq">How staking works</Link>
          </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
