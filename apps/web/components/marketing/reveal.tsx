"use client";

import * as React from "react";
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";

/**
 * Fade + rise into view, once. Respects prefers-reduced-motion (renders children
 * as-is). Keep it subtle: small distance, short ease-out, never a full fly-in.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  as = "div",
  mount = false,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "li" | "section" | "figure";
  /** Animate on mount instead of on scroll-into-view (for above-the-fold content). */
  mount?: boolean;
}) {
  const reduce = useReducedMotion();
  const MotionTag = motion[as];

  if (reduce) {
    // Reduced motion: no animation, plain element with the same classes.
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }

  const animateProps = mount
    ? { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } }
    : { initial: { opacity: 0, y: 16 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-80px" } };

  return (
    <MotionTag
      className={className}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      {...animateProps}
    >
      {children}
    </MotionTag>
  );
}

/**
 * Soft scroll parallax for decorative layers. Translates Y as the element
 * passes through the viewport. Disabled under reduced-motion.
 *
 * `range` is the px travel distance; positive moves slower-than-scroll (sinks),
 * negative moves faster (rises). Keep it small (10–40) so it never feels off.
 */
export function Parallax({
  children,
  className,
  range = 24,
}: {
  children: React.ReactNode;
  className?: string;
  range?: number;
}) {
  const reduce = useReducedMotion();
  const ref = React.useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [range, -range]);

  if (reduce) {
    return (
      <div ref={ref} className={className}>
        {children}
      </div>
    );
  }

  return (
    <motion.div ref={ref} style={{ y }} className={className}>
      {children}
    </motion.div>
  );
}

/**
 * Count a number up from `from` to `value` when it scrolls into view.
 * Extracts a leading prefix/suffix (e.g. "$1.2M", "4×", "40%") and animates
 * only the numeric part. Reduced motion renders the final value instantly.
 */
export function Counter({
  value,
  from = 0,
  className,
  duration = 1.2,
}: {
  value: string;
  from?: number;
  className?: string;
  duration?: number;
}) {
  const reduce = useReducedMotion();
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  // Split "value" into [prefix, number, suffix], e.g. "$1.2M" -> ["$", 1.2, "M"].
  const match = value.match(/^([^0-9.-]*)([0-9.]+)(.*)$/);
  const prefix = match?.[1] ?? "";
  const target = match ? parseFloat(match[2]) : 0;
  const suffix = match?.[3] ?? "";
  const hasDecimal = match?.[2]?.includes(".") ?? false;

  const display = useMotionValue(from);
  const [rounded, setRounded] = React.useState(reduce ? target : from);

  React.useEffect(() => {
    if (reduce || !inView) return;
    const controls = animate(display, target, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate(v) {
        setRounded(hasDecimal ? Math.round(v * 10) / 10 : Math.round(v));
      },
    });
    return () => controls.stop();
  }, [display, inView, reduce, target, duration, hasDecimal]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {hasDecimal ? rounded.toFixed(1) : rounded.toLocaleString()}
      {suffix}
    </span>
  );
}
