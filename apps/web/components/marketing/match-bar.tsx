"use client";

import * as React from "react";
import { animate, useReducedMotion } from "motion/react";

/**
 * Animated match-score demo shown under a feature. The score counts up and the
 * skill chips fade in when the parent enters `.group:hover`. Reduced motion
 * renders the final state with no counting.
 *
 * Pure CSS drives the bar fill (via group-hover), so the JS only animates the
 * number, cheap and smooth.
 */
export function MatchBar({ score, skills }: { score: number; skills: string[] }) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = React.useState(reduce ? score : 0);

  React.useEffect(() => {
    if (reduce) return;
    // Re-run the count whenever the component mounts into view shortly after.
    const controls = animate(0, score, {
      duration: 1,
      ease: [0.22, 1, 0.36, 1],
      repeat: Infinity,
      repeatType: "reverse",
      repeatDelay: 1.6,
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [reduce, score]);

  return (
    <div className="mt-4 max-h-0 overflow-hidden opacity-0 transition-[max-height,opacity,margin] duration-300 group-hover:mt-4 group-hover:max-h-32 group-hover:opacity-100">
      <div className="rounded-lg border border-border bg-muted/50 p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-muted-foreground">Match score</span>
          <span className="font-mono font-semibold tabular-nums text-primary">{display}%</span>
        </div>
        {/* bar fill grows on group-hover */}
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60 transition-[width] duration-700 ease-out [width:0%] group-hover:[width:var(--score)]"
            style={{ ["--score" as string]: `${score}%` }}
          />
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1">
          {skills.map((skill) => (
            <span
              key={skill}
              className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
            >
              {skill}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
