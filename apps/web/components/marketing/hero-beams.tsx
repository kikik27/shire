import { type CSSProperties } from "react";
import { cn } from "@/lib/utils";

/**
 * Decorative animated light beams behind the hero. Pure CSS (no JS), token-based colors.
 * Motion is globally disabled under `prefers-reduced-motion` via globals.css, leaving the
 * static glow + grid as the calm fallback.
 */
const beams = [
  { left: "10%", width: 1, dur: "7s", delay: "0s", color: "via-primary" },
  { left: "24%", width: 2, dur: "9.5s", delay: "1.8s", color: "via-chart-2" },
  { left: "38%", width: 1, dur: "6.5s", delay: "0.7s", color: "via-primary" },
  { left: "52%", width: 1, dur: "8.5s", delay: "2.4s", color: "via-chart-2" },
  { left: "67%", width: 2, dur: "7.5s", delay: "1.1s", color: "via-primary" },
  { left: "81%", width: 1, dur: "9s", delay: "0.3s", color: "via-chart-2" },
  { left: "92%", width: 1, dur: "6.8s", delay: "2s", color: "via-primary" },
] as const;

export function HeroBeams() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden mask-fade-b"
    >
      {beams.map((beam, i) => (
        <span
          key={i}
          className={cn(
            "animate-beam absolute -top-1/3 h-[45%] rounded-full bg-gradient-to-b from-transparent to-transparent blur-[1px]",
            beam.color,
          )}
          style={
            {
              left: beam.left,
              width: `${beam.width}px`,
              "--beam-dur": beam.dur,
              "--beam-delay": beam.delay,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
