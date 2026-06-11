"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Briefcase, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Mode = "job" | "talent";

const placeholders: Record<Mode, string> = {
  job: "Senior frontend role, React + TypeScript, remote…",
  talent: "Solidity engineer, 4+ yrs, has shipped on Celo…",
};

/**
 * The copilot prompt — a believable "describe what you want" entry point.
 * Frontend-only: submitting routes into the app shell rather than calling an API.
 */
export function HeroPrompt() {
  const router = useRouter();
  const [mode, setMode] = React.useState<Mode>("job");
  const [value, setValue] = React.useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push("/dashboard");
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto w-full max-w-2xl rounded-2xl border border-white/10 bg-white/[0.04] p-2 shadow-2xl shadow-black/30 backdrop-blur"
    >
      <div className="flex items-center gap-1 p-1" role="tablist" aria-label="Search mode">
        {(
          [
            { id: "job", label: "Find a job", icon: Briefcase },
            { id: "talent", label: "Find talent", icon: Users },
          ] as const
        ).map((tab) => {
          const active = mode === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setMode(tab.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <tab.icon className="size-4" aria-hidden="true" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 p-1 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-2 rounded-xl bg-background/60 px-3">
          <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <label htmlFor="hero-query" className="sr-only">
            {mode === "job" ? "Describe the job you want" : "Describe the talent you need"}
          </label>
          <input
            id="hero-query"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholders[mode]}
            className="h-11 w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
        <Button type="submit" size="lg" className="group h-11 shrink-0">
          Match me
          <ArrowRight className="size-4 transition-transform duration-150 group-hover:translate-x-0.5" />
        </Button>
      </div>
    </form>
  );
}
