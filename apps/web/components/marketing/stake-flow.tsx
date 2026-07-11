"use client";

import * as React from "react";
import {
  Briefcase as BriefcaseIcon,
  CheckCircle2,
  Lock as LockIcon,
  RotateCcw,
  Users as UsersIcon,
} from "lucide-react";
import { useReducedMotion } from "motion/react";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Reveal } from "@/components/marketing/reveal";
import { cn } from "@/lib/utils";

type FlowRole = "candidate" | "recruiter";
type FlowIcon = typeof UsersIcon;

type FlowStep = {
  label: string;
  detail: string;
  icon: FlowIcon;
  badge?: string;
};

const flowCopy: Record<FlowRole, { label: string; description: string; steps: FlowStep[] }> = {
  candidate: {
    label: "Candidate",
    description:
      "Candidate stakes when applying. Shire holds it during review, then returns it after the application is officially accepted or rejected.",
    steps: [
      {
        label: "Apply + stake",
        detail: "Candidate applies to a role and commits 250 XLM.",
        icon: UsersIcon,
        badge: "250 XLM",
      },
      {
        label: "Escrow",
        detail: "The stake is locked while the company reviews.",
        icon: LockIcon,
      },
      {
        label: "Company review",
        detail: "The company accepts or rejects the application.",
        icon: BriefcaseIcon,
      },
      {
        label: "Stake returned",
        detail: "The stake returns to the candidate after the decision is final.",
        icon: RotateCcw,
        badge: "Back to candidate",
      },
    ],
  },
  recruiter: {
    label: "Recruiter",
    description:
      "Recruiter stakes when opening a role. Shire holds that commitment while the role is active, then resolves it after hiring is finalized.",
    steps: [
      {
        label: "Open + stake",
        detail: "Recruiter opens a role and commits 250 XLM.",
        icon: BriefcaseIcon,
        badge: "250 XLM",
      },
      {
        label: "Escrow",
        detail: "The role stake is locked while the opening is live.",
        icon: LockIcon,
      },
      {
        label: "Candidates apply",
        detail: "Candidates apply and add their own application stakes.",
        icon: UsersIcon,
      },
      {
        label: "Finalize hire",
        detail: "Finalize the hiring outcome to resolve the recruiter's stake.",
        icon: CheckCircle2,
        badge: "Stake resolved",
      },
    ],
  },
};

export function StakeFlow() {
  const reduce = useReducedMotion();
  const [role, setRole] = React.useState<FlowRole>("candidate");
  const [step, setStep] = React.useState(0);
  const [touched, setTouched] = React.useState(false);

  const activeFlow = flowCopy[role];

  React.useEffect(() => {
    if (touched || reduce) return;
    const id = window.setInterval(() => {
      setStep((current) => (current + 1) % activeFlow.steps.length);
    }, 2600);
    return () => window.clearInterval(id);
  }, [activeFlow.steps.length, reduce, touched]);

  function selectRole(nextRole: FlowRole) {
    setTouched(true);
    setRole(nextRole);
    setStep(0);
  }

  function selectStep(nextStep: number) {
    setTouched(true);
    setStep(nextStep);
  }

  return (
    <section id="how-it-works" className="scroll-mt-20">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <SectionHeading
          eyebrow="How it works"
          title="Watch a stake move through Shire"
          description="Choose a side and follow the beam. The primary path shows how commitment moves through the product."
        />

        <Reveal>
          <div className="mx-auto mt-12 flex max-w-md items-center justify-center gap-2 rounded-full border border-border bg-card p-1.5 shadow-sm">
            {(["candidate", "recruiter"] as const).map((item) => {
              const active = role === item;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => selectRole(item)}
                  aria-pressed={active}
                  className={cn(
                    "inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {item === "candidate" ? (
                    <UsersIcon className="size-4" aria-hidden="true" />
                  ) : (
                    <BriefcaseIcon className="size-4" aria-hidden="true" />
                  )}
                  {flowCopy[item].label}
                </button>
              );
            })}
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="relative mx-auto mt-12 max-w-5xl overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-10">
            <p className="mx-auto max-w-3xl text-center text-sm leading-6 text-muted-foreground">
              {activeFlow.description}
            </p>

            <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-[1fr_0.5fr_1fr_0.5fr_1fr_0.5fr_1fr] md:items-start">
              {activeFlow.steps.map((item, index) => (
                <React.Fragment key={item.label}>
                  <FlowNode
                    step={item}
                    active={step === index}
                    complete={step > index}
                    onClick={() => selectStep(index)}
                  />
                  {index < activeFlow.steps.length - 1 ? (
                    <AnimatedConnector
                      active={step > index}
                      moving={step === index + 1}
                      paused={Boolean(reduce)}
                    />
                  ) : null}
                </React.Fragment>
              ))}
            </div>

            <p className="mt-8 text-center text-sm font-medium text-foreground">
              {activeFlow.steps[step]?.detail}
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function FlowNode({
  step,
  active,
  complete,
  onClick,
}: {
  step: FlowStep;
  active: boolean;
  complete: boolean;
  onClick: () => void;
}) {
  const Icon = step.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-32 flex-col items-center justify-start gap-3 rounded-xl px-2 py-1 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        className={cn(
          "relative grid size-16 place-items-center rounded-2xl border bg-background text-muted-foreground transition-all duration-300 sm:size-20",
          active && "scale-105 border-primary bg-primary/10 text-primary shadow-lg shadow-primary/15",
          complete && !active && "border-primary/30 text-primary",
        )}
      >
        <Icon className="size-6 sm:size-7" aria-hidden="true" />
        {step.badge && active ? (
          <span className="absolute -bottom-4 left-1/2 inline-flex -translate-x-1/2 whitespace-nowrap rounded-full border border-primary/30 bg-background px-2.5 py-1 text-[11px] font-semibold text-primary shadow-sm">
            {step.badge}
          </span>
        ) : null}
      </span>
      <span className="mt-4 text-sm font-semibold text-foreground">{step.label}</span>
    </button>
  );
}

function AnimatedConnector({
  active,
  moving,
  paused,
}: {
  active: boolean;
  moving: boolean;
  paused: boolean;
}) {
  return (
    <div className="relative flex h-8 items-center md:h-20" aria-hidden="true">
      <span
        className={cn(
          "absolute left-1/2 top-0 h-full w-px -translate-x-1/2 md:left-0 md:top-1/2 md:h-px md:w-full md:translate-x-0 md:-translate-y-1/2",
          active ? "bg-primary/25" : "bg-border",
        )}
      />
      <span
        className={cn(
          "absolute left-1/2 top-0 h-1/2 w-px -translate-x-1/2 bg-primary/70 shadow-[0_0_18px_hsl(var(--primary)/0.7)] md:left-0 md:top-1/2 md:h-px md:w-1/2 md:translate-x-0 md:-translate-y-1/2",
          moving && !paused && "animate-[stake-beam-y_1.7s_ease-in-out_infinite] md:animate-[stake-beam-x_1.7s_ease-in-out_infinite]",
          moving ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}
