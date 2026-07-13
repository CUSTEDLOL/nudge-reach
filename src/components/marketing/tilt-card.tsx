"use client";

import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
} from "motion/react";
import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useReducedMotionSafe } from "./motion-primitives";

const SURFACE =
  "relative h-full rounded-2xl border border-emerald-950/[0.05] bg-[#edf7f1] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]";

/**
 * The daylight card, made physical: spring-damped tilt toward the cursor,
 * a brand-green border glow and interior spotlight that track the pointer,
 * and real Z-depth for children that opt in via `[transform:translateZ(…)]`.
 * Touch and reduced-motion visitors get the same card, still.
 */
export function TiltCard({
  children,
  className,
  surfaceClassName,
  max = 6,
}: {
  children: ReactNode;
  className?: string;
  surfaceClassName?: string;
  /** Peak tilt in degrees per axis. */
  max?: number;
}) {
  const reduce = useReducedMotionSafe();
  const ref = useRef<HTMLDivElement>(null);
  const rx = useSpring(useMotionValue(0), { stiffness: 180, damping: 20 });
  const ry = useSpring(useMotionValue(0), { stiffness: 180, damping: 20 });
  const scale = useSpring(useMotionValue(1), { stiffness: 260, damping: 24 });
  const transform = useMotionTemplate`perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) scale(${scale})`;

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse") return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    ry.set((px - 0.5) * max * 2);
    rx.set((0.5 - py) * max * 2);
    scale.set(1.02);
    el.style.setProperty("--mx", `${px * 100}%`);
    el.style.setProperty("--my", `${py * 100}%`);
  }

  function onLeave() {
    rx.set(0);
    ry.set(0);
    scale.set(1);
  }

  if (reduce) {
    return (
      <div className={cn("h-full", className)}>
        <div className={cn(SURFACE, surfaceClassName)}>{children}</div>
      </div>
    );
  }

  return (
    <motion.div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      style={{ transform, transformStyle: "preserve-3d" }}
      className={cn(
        "group/tilt relative h-full will-change-transform hover:z-10",
        className
      )}
    >
      {/* cursor-tracked glow — peeks past the surface as a lit 1px border */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-px rounded-[17px] opacity-0 transition-opacity duration-300 group-hover/tilt:opacity-100"
        style={{
          background:
            "radial-gradient(260px circle at var(--mx, 50%) var(--my, 50%), rgba(6,193,103,0.5), rgba(6,193,103,0.08) 45%, transparent 70%)",
        }}
      />
      <div
        className={cn(
          SURFACE,
          "transition-shadow duration-300 group-hover/tilt:shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_26px_52px_-24px_rgba(10,31,26,0.28)]",
          surfaceClassName
        )}
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* interior spotlight + glare, clipped by their own radius */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover/tilt:opacity-100"
          style={{
            background:
              "radial-gradient(340px circle at var(--mx, 50%) var(--my, 50%), rgba(6,193,103,0.09), transparent 65%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover/tilt:opacity-60"
          style={{
            background:
              "radial-gradient(190px circle at var(--mx, 50%) var(--my, 50%), rgba(255,255,255,0.8), transparent 62%)",
          }}
        />
        {children}
      </div>
    </motion.div>
  );
}

/** White icon chip that floats above the card plane. */
export function TiltChip({ children }: { children: ReactNode }) {
  return (
    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-brand-600 shadow-[0_12px_24px_-12px_rgba(10,31,26,0.3),inset_0_1px_0_#fff] ring-1 ring-black/[0.03] [transform:translateZ(34px)]">
      {children}
    </span>
  );
}
