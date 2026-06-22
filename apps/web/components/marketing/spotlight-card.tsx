"use client";

import * as React from "react";
import { useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * A surface that shows a soft, single-color radial glow following the pointer.
 * Intentionally restrained: hover-only, low opacity, large blur, one color.
 * No rainbow, no flicker. A warm reading light, not a laser show.
 *
 * Disabled under prefers-reduced-motion and on touch/coarse pointers.
 */
export function SpotlightCard({
  children,
  className,
  glowClassName,
}: {
  children: React.ReactNode;
  className?: string;
  /** Override the glow color/opacity, e.g. "bg-chart-3/20". Defaults to primary. */
  glowClassName?: string;
}) {
  const reduce = useReducedMotion();
  const ref = React.useRef<HTMLDivElement>(null);

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    if (reduce || !ref.current) return;
    // Only honor fine pointers (mouse/trackpad), not touch.
    if (!window.matchMedia("(pointer: fine)").matches) return;

    const rect = ref.current.getBoundingClientRect();
    ref.current.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    ref.current.style.setProperty("--my", `${e.clientY - rect.top}px`);
  }

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      className={cn("group/spot relative overflow-hidden", className)}
    >
      {/* the glow layer starts at opacity 0 and fades in on hover */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 [background:radial-gradient(220px_circle_at_var(--mx)_var(--my),var(--spot-color,oklch(0.6_0.16_35_/_0.10)),transparent_70%)] group-hover/spot:opacity-100",
          glowClassName,
        )}
      />
      {/* content sits above the glow */}
      <div className="relative">{children}</div>
    </div>
  );
}
