import Link from "next/link";
import { RefreshCw, ShieldCheck, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/marketing/section-heading";

const points = [
  {
    icon: Wallet,
    title: "Free to join",
    body: "Build your AI profile, browse roles, and get matched without paying a cent.",
  },
  {
    icon: ShieldCheck,
    title: "You only ever stake",
    body: "No monthly fee. The only money in play is a stake locked in onchain escrow — never a payment to us.",
  },
  {
    icon: RefreshCw,
    title: "Refunded on success",
    body: "Stake is released back the moment both sides confirm. It's a commitment, not a cost.",
  },
];

export function StakeModel() {
  return (
    <section id="stake" className="scroll-mt-20 bg-card">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <SectionHeading
          eyebrow="No pricing — just stake"
          title="You don't pay to use Shire. You stake."
          description="There's no subscription and no platform fee on your stake. Both sides lock a small, refundable stablecoin stake in escrow — it signals real commitment and comes straight back when the hire works out."
        />

        <div className="mx-auto mt-14 grid max-w-5xl gap-6 md:grid-cols-3">
          {points.map((point) => (
            <div
              key={point.title}
              className="flex flex-col rounded-2xl border border-border bg-background p-6"
            >
              <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                <point.icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 font-semibold tracking-tight">{point.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{point.body}</p>
            </div>
          ))}
        </div>

        {/* Reassurance for people who've never touched crypto. */}
        <div className="mx-auto mt-8 flex max-w-5xl flex-col gap-4 rounded-2xl border border-border bg-background p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <p className="text-sm text-foreground/90">
              <span className="font-medium">New to crypto? You don&apos;t need to be.</span>{" "}
              Sign in with email or Google and Shire creates a secure wallet for you — no seed
              phrases. Stakes show in USD-pegged cUSD and never leave escrow until you both confirm.
            </p>
          </div>
          <Button asChild size="sm" variant="outline" className="shrink-0">
            <Link href="#faq">How staking works</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
