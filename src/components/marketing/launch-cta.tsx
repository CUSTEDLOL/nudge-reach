"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { BookDemoButton } from "./book-demo";
import type { ButtonSize, ButtonVariant } from "./button";

/**
 * "Book a Demo", with a launch.
 *
 * Hovering any demo CTA fires a full launch sequence: a WhatsApp bubble
 * ignites out of the pill, punches through a billowing cloud bank and
 * climbs off-stage, trailing exhaust and sparks, with a shockwave ring
 * spreading behind it.
 *
 * The scene renders through a PORTAL into `document.body` as a fixed
 * overlay. That is load-bearing, not incidental: the hero section and the
 * navbar pill are both `overflow-hidden`, so anything rendered inline
 * would be clipped flat. The portal also means call sites need no layout
 * changes at all — the button stays exactly where it was.
 *
 * The stage is 50vw x 50vh — a quarter of the viewport — anchored to the
 * hovered button and clamped to stay on screen.
 */

/** Stage covers a quarter of the viewport: 0.5 x 0.5. */
const STAGE_VW = 0.5;
const STAGE_VH = 0.5;

type Stage = {
  left: number;
  top: number;
  width: number;
  height: number;
  /** -1 launches up the screen, +1 launches down. */
  dir: number;
};

/** The cloud bank — deterministic so it reads the same every fire. */
const CLOUDS = [
  { x: -38, y: 2, s: 1.0, d: 0.0 },
  { x: -22, y: -6, s: 1.35, d: 0.04 },
  { x: -8, y: 4, s: 1.1, d: 0.02 },
  { x: 8, y: -4, s: 1.4, d: 0.06 },
  { x: 22, y: 3, s: 1.15, d: 0.03 },
  { x: 38, y: -2, s: 0.95, d: 0.08 },
  { x: -30, y: 8, s: 0.8, d: 0.12 },
  { x: 30, y: 9, s: 0.85, d: 0.1 },
];

/** Sparks thrown off at ignition. */
const SPARKS = [
  { x: -18, r: 1.0 },
  { x: -11, r: 0.7 },
  { x: -5, r: 1.2 },
  { x: 4, r: 0.8 },
  { x: 10, r: 1.1 },
  { x: 17, r: 0.75 },
  { x: -24, r: 0.6 },
  { x: 23, r: 0.65 },
];

export function LaunchDemoButton({
  children = "Book a Demo",
  variant,
  size,
  className,
  tone = "light",
}: {
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  /** Surface behind the launch — decides the smoke colour. */
  tone?: "light" | "dark";
}) {
  const [stage, setStage] = useState<Stage | null>(null);
  const reduced = useReducedMotion();

  const ignite = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = vw * STAGE_VW;
    const height = vh * STAGE_VH;

    // Buttons near the top of the screen (the navbar) launch downward —
    // upward they would fly straight off the top edge.
    const dir = r.top < vh * 0.25 ? 1 : -1;
    const originX = r.left + r.width / 2;

    setStage({
      left: Math.min(Math.max(8, originX - width / 2), vw - width - 8),
      top: dir === 1 ? r.bottom - 12 : r.top + 12 - height,
      width,
      height,
      dir,
    });
  }, []);

  const button = (
    <BookDemoButton variant={variant} size={size} className={className}>
      {children}
    </BookDemoButton>
  );

  // No scene at all when the visitor asked for less motion — the button
  // keeps whatever hover treatment its own classes give it.
  if (reduced) return button;

  // Full-width call sites (the mobile menu) must not be shrunk to
  // shrink-wrap by the wrapper span.
  const full = className?.includes("w-full") ? "w-full" : "";

  return (
    <span
      className={cn("relative inline-flex", full)}
      onMouseEnter={(e) => ignite(e.currentTarget)}
      onMouseLeave={() => setStage(null)}
      onFocus={(e) => ignite(e.currentTarget)}
      onBlur={() => setStage(null)}
    >
      <motion.span
        className={cn("inline-flex origin-center", full)}
        animate={stage ? "launch" : "rest"}
        variants={{
          rest: { scale: 1, transition: { duration: 0.25 } },
          launch: {
            scale: [1, 1.04, 0.97, 1],
            transition: { duration: 0.6, times: [0, 0.15, 0.3, 1] },
          },
        }}
      >
        {button}
      </motion.span>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {stage && <LaunchScene stage={stage} tone={tone} />}
          </AnimatePresence>,
          document.body
        )}
    </span>
  );
}

function LaunchScene({ stage, tone }: { stage: Stage; tone: "light" | "dark" }) {
  const { width, height, dir } = stage;
  const travel = height * 0.92 * dir;
  const smoke = tone === "dark" ? "255,255,255" : "12,32,24";
  // Origin sits at the edge of the stage nearest the button.
  const originStyle = dir === 1 ? { top: 0 } : { bottom: 0 };

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed z-[60]"
      style={{
        left: stage.left,
        top: stage.top,
        width,
        height,
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.35 } }}
      transition={{ duration: 0.12 }}
    >
      {/* ambient brand glow washing the whole stage */}
      <motion.div
        className="absolute left-1/2 h-[60%] w-[80%] -translate-x-1/2 rounded-full blur-[60px]"
        style={{ ...originStyle, background: "rgba(6,193,103,0.35)" }}
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: [0, 0.9, 0], scale: [0.4, 1.2, 1.5] }}
        transition={{ duration: 1.5, times: [0, 0.3, 1], ease: "easeOut" }}
      />

      {/* shockwave ring */}
      <motion.div
        className="absolute left-1/2 aspect-square w-[42%] -translate-x-1/2 rounded-full border-2"
        style={{ ...originStyle, borderColor: "rgba(6,193,103,0.55)" }}
        initial={{ opacity: 0, scale: 0.1 }}
        animate={{ opacity: [0, 0.8, 0], scale: [0.1, 1.6, 2.4] }}
        transition={{ duration: 1.1, delay: 0.16, ease: "easeOut" }}
      />

      {/* cloud bank */}
      {CLOUDS.map((c, i) => (
        <motion.div
          key={i}
          className="absolute left-1/2 rounded-full blur-[26px]"
          style={{
            ...originStyle,
            width: width * 0.34,
            height: width * 0.34,
            marginLeft: -(width * 0.17),
            background: `rgba(${smoke},0.55)`,
          }}
          initial={{ opacity: 0, scale: 0.2, x: 0, y: 0 }}
          animate={{
            opacity: [0, 0.95, 0.7, 0],
            scale: [0.2, c.s, c.s * 1.5],
            x: [0, (width / 100) * c.x, (width / 100) * c.x * 1.5],
            y: [0, (height / 100) * c.y * dir, (height / 100) * c.y * 2 * dir],
          }}
          transition={{
            duration: 1.6,
            delay: 0.1 + c.d,
            times: [0, 0.28, 0.6, 1],
            ease: "easeOut",
          }}
        />
      ))}

      {/* sparks thrown off at ignition */}
      {SPARKS.map((s, i) => (
        <motion.div
          key={i}
          className="absolute left-1/2 h-1.5 w-1.5 rounded-full bg-brand-300"
          style={originStyle}
          initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
          animate={{
            opacity: [0, 1, 0],
            scale: [0, s.r, 0],
            x: [0, (width / 100) * s.x * 1.6],
            y: [0, height * 0.1 * dir, height * 0.02 * -dir],
          }}
          transition={{ duration: 0.9, delay: 0.14, ease: "easeOut" }}
        />
      ))}

      {/* exhaust trail — a tapered column the bubble drags behind it */}
      <motion.div
        className="absolute left-1/2 w-[7%] -translate-x-1/2 rounded-full blur-[10px]"
        style={{
          ...originStyle,
          height: height * 0.5,
          background:
            dir === 1
              ? "linear-gradient(to top, rgba(6,193,103,0), rgba(255,214,102,0.85))"
              : "linear-gradient(to bottom, rgba(6,193,103,0), rgba(255,214,102,0.85))",
          transformOrigin: dir === 1 ? "top" : "bottom",
        }}
        initial={{ opacity: 0, scaleY: 0 }}
        animate={{ opacity: [0, 0.9, 0], scaleY: [0, 1, 0.2] }}
        transition={{ duration: 1.2, delay: 0.16, ease: "easeOut" }}
      />

      {/* the bubble itself */}
      <motion.div
        className="absolute left-1/2 flex items-center justify-center rounded-[26px] bg-brand-500 shadow-[0_20px_60px_-12px_rgba(6,193,103,0.9)]"
        style={{
          ...originStyle,
          width: 112,
          height: 78,
          marginLeft: -56,
        }}
        initial={{ opacity: 0, scale: 0.3, y: 0, rotate: 0 }}
        animate={{
          opacity: [0, 1, 1, 1, 0],
          scale: [0.3, 1.12, 1, 0.92, 0.7],
          // beat 3 is the crouch — a dip back the way it came
          y: [0, 0, -14 * dir, travel, travel * 1.2],
          rotate: [0, 0, -3, 10, 14],
          transition: {
            duration: 1.5,
            times: [0, 0.16, 0.26, 0.82, 1],
            ease: ["backOut", "easeOut", "easeIn", "easeOut"],
          },
        }}
      >
        {/* tail, hanging off the edge it is travelling away from */}
        <div
          className="absolute left-7 h-6 w-6 rotate-45 rounded-[5px] bg-brand-500"
          style={dir === 1 ? { top: -6 } : { bottom: -6 }}
        />
        <svg viewBox="0 0 24 12" className="relative h-7 w-14" fill="none">
          {["M1.5 6.5 5 10 11.5 2.5", "M9.5 6.5 13 10 19.5 2.5"].map((d, i) => (
            <motion.path
              key={i}
              d={d}
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0, stroke: "#ffffff" }}
              animate={{
                pathLength: 1,
                opacity: 1,
                stroke: ["#ffffff", "#ffffff", "#34b7f1"],
                transition: {
                  pathLength: { duration: 0.3, delay: 0.18, ease: "easeOut" },
                  opacity: { duration: 0.12, delay: 0.18 },
                  stroke: { duration: 1.5, times: [0, 0.45, 0.62] },
                },
              }}
            />
          ))}
        </svg>
      </motion.div>
    </motion.div>
  );
}
