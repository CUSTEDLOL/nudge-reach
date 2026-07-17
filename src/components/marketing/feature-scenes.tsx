"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/cn";
import { Stagger, StaggerItem, useReducedMotionSafe } from "./motion-primitives";

/* ------------------------------------------------------------------ *
 * THE BENTO, product edition. Five features; at rest each card shows
 * its name as giant outlined display type on a quiet tint. Hover
 * deepens the tint, fades the nameplate, reveals the label/headline/
 * line up top and the feature illustration below — a slow, polished
 * product reveal (opacity + scale 0.94→1 + 20px rise + 6px deblur,
 * 600ms, cubic-bezier(0.22,1,0.36,1)). Only the hovered card moves;
 * dimensions never change. Touch/reduced-motion show the revealed
 * state directly.
 * ------------------------------------------------------------------ */

type Feature = {
  word: string;
  label: string;
  headline: string;
  body: string;
  img: string;
  /** Rest tint / hover tint. */
  tint: string;
  hoverTint: string;
  wide?: boolean;
};

const FEATURES: Feature[] = [
  {
    word: "AI AGENT",
    label: "Personalized AI Agent",
    headline: "Every conversation feels personal.",
    body: "An intelligent WhatsApp agent that remembers preferences, responds instantly and follows up automatically.",
    img: "/features/ai-agent.webp",
    tint: "#f6f8f7",
    hoverTint: "#cee4d5",
    wide: true,
  },
  {
    word: "BROADCAST",
    label: "Broadcast Marketing",
    headline: "Reach every customer at once.",
    body: "Create targeted WhatsApp campaigns, segment audiences and track delivery and engagement.",
    img: "/features/broadcast.webp",
    tint: "#f6f8f7",
    hoverTint: "#ead7b8",
  },
  {
    word: "ANALYTICS",
    label: "Real-Time Analytics",
    headline: "See what is happening right now.",
    body: "Track conversations, response times, leads, conversions and revenue as they change.",
    img: "/features/analytics.webp",
    tint: "#f6f8f7",
    hoverTint: "#ccdfeb",
  },
  {
    word: "INTEGRATIONS",
    label: "Integrations",
    headline: "Connect the tools you already use.",
    body: "Sync Nudge with calendars, payment systems, CRMs, spreadsheets and commerce platforms.",
    img: "/features/integrations.webp",
    tint: "#f6f8f7",
    hoverTint: "#d9d2e8",
  },
  {
    word: "GREEN TICK",
    label: "Green Tick Verification",
    headline: "Turn trust into more conversations.",
    body: "Get guidance for WhatsApp business verification and strengthen customer confidence.",
    img: "/features/green-tick.webp",
    tint: "#f6f8f7",
    hoverTint: "#c9e1ce",
  },
];

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

/** Shared "(hover: none)" subscription — touch devices skip hover. */
function useCoarsePointer() {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(hover: none)");
    const update = () => setCoarse(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return coarse;
}

function FeatureCard({ f }: { f: Feature }) {
  const [hov, setHov] = useState(false);
  const coarse = useCoarsePointer();
  const reduce = useReducedMotionSafe();
  const revealed = hov || coarse || reduce;
  // Hover-only physics (lift) stay off for touch/reduced-motion.
  const lifted = hov && !coarse && !reduce;

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      className="relative h-full min-h-[24rem] overflow-hidden rounded-3xl border border-ink/25"
      style={{
        backgroundColor: revealed ? f.hoverTint : f.tint,
        transform: lifted ? "translateY(-4px)" : "translateY(0)",
        boxShadow: lifted
          ? "0 30px 56px -32px rgba(10,31,26,0.28)"
          : "0 16px 36px -28px rgba(10,31,26,0.24)",
        transition: `background-color 500ms ${EASE}, transform 500ms ${EASE}, box-shadow 500ms ${EASE}`,
      }}
    >
      {/* resting nameplate */}
      <div
        aria-hidden
        className="absolute inset-0 grid place-items-center px-6"
        style={{
          opacity: revealed ? 0 : 1,
          transform: revealed ? "translateY(-12px) scale(0.96)" : "none",
          transition: `opacity 450ms ${EASE}, transform 450ms ${EASE}`,
        }}
      >
        <span
          className={cn(
            "select-none text-center font-display font-black uppercase leading-[0.95] tracking-[-0.02em] text-transparent",
            f.wide
              ? "text-[clamp(2.2rem,4.8vw,3.6rem)]"
              : "text-[clamp(1.5rem,2.4vw,2.2rem)]"
          )}
          style={{ WebkitTextStroke: "1.8px rgba(10,31,26,0.58)" }}
        >
          {f.word}
        </span>
      </div>

      {/* revealed state */}
      <div className="relative flex h-full flex-col p-6 sm:p-7">
        {/* copy */}
        <div
          style={{
            opacity: revealed ? 1 : 0,
            transform: revealed ? "translateY(0)" : "translateY(10px)",
            transition: `opacity 500ms ${EASE}, transform 500ms ${EASE}`,
          }}
        >
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-brand-700">
            {f.label}
          </p>
          <h3 className="mt-2 font-display text-[1.3rem] font-black leading-tight tracking-[-0.02em] text-ink sm:text-[1.45rem]">
            {f.headline}
          </h3>
          <p
            className={cn(
              "mt-1.5 max-w-md text-[13px] leading-relaxed text-ink/55",
              !f.wide && "hidden min-[420px]:block"
            )}
          >
            {f.body}
          </p>
        </div>

        {/* illustration — the premium reveal */}
        <div
          className="relative mt-4 min-h-0 flex-1"
          style={{
            opacity: revealed ? 1 : 0,
            transform: revealed ? "translateY(0) scale(1)" : "translateY(20px) scale(0.94)",
            filter: revealed ? "blur(0px)" : "blur(6px)",
            transition: `opacity 600ms ${EASE}, transform 600ms ${EASE}, filter 600ms ${EASE}`,
          }}
        >
          <Image
            src={f.img}
            alt={f.label}
            fill
            sizes={f.wide ? "(max-width: 768px) 100vw, 66vw" : "(max-width: 768px) 100vw, 33vw"}
            className="object-contain object-bottom"
            style={{
              filter: "drop-shadow(0 10px 24px rgba(10,31,26,0.10))",
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function FeatureScenes() {
  return (
    <Stagger className="mx-auto mt-14 grid max-w-6xl grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
      {FEATURES.map((f) => (
        <StaggerItem
          key={f.word}
          className={cn("h-full", f.wide && "md:col-span-2")}
        >
          <FeatureCard f={f} />
        </StaggerItem>
      ))}
    </Stagger>
  );
}
