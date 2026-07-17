"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/cn";
import { Stagger, StaggerItem, useReducedMotionSafe } from "./motion-primitives";

/* ------------------------------------------------------------------ *
 * THE BENTO, product edition. Five features; at rest each card shows
 * its name as giant outlined display type on a quiet tint. Hover
 * deepens the tint, fades the nameplate, builds the real feature name
 * word-by-word, then assembles the illustration from a deterministic
 * mosaic. Only the hovered card moves; dimensions never change.
 * Touch/reduced-motion show the completed state directly.
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
    hoverTint: "#c4dfcd",
    wide: true,
  },
  {
    word: "BROADCAST",
    label: "Broadcast Marketing",
    headline: "Reach every customer at once.",
    body: "Create targeted WhatsApp campaigns, segment audiences and track delivery and engagement.",
    img: "/features/broadcast.webp",
    tint: "#f6f8f7",
    hoverTint: "#e6cfaa",
  },
  {
    word: "ANALYTICS",
    label: "Real-Time Analytics",
    headline: "See what is happening right now.",
    body: "Track conversations, response times, leads, conversions and revenue as they change.",
    img: "/features/analytics.webp",
    tint: "#f6f8f7",
    hoverTint: "#c1d9e7",
  },
  {
    word: "INTEGRATIONS",
    label: "Integrations",
    headline: "Connect the tools you already use.",
    body: "Sync Nudge with calendars, payment systems, CRMs, spreadsheets and commerce platforms.",
    img: "/features/integrations.webp",
    tint: "#f6f8f7",
    hoverTint: "#d1c8e5",
  },
  {
    word: "GREEN TICK",
    label: "Green Tick Verification",
    headline: "Turn trust into more conversations.",
    body: "Get guidance for WhatsApp business verification and strengthen customer confidence.",
    img: "/features/green-tick.webp",
    tint: "#f6f8f7",
    hoverTint: "#bfdac5",
  },
];

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const TILE_COLS = 6;
const TILE_ROWS = 4;

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
  const animatedReveal = lifted;

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
          transition: `opacity 260ms ${EASE}, transform 420ms ${EASE}`,
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
        <div>
          <h3
            className={cn(
              "flex max-w-xl flex-wrap gap-x-[0.24em] overflow-hidden font-display font-black uppercase leading-[0.92] tracking-[-0.035em] text-ink",
              f.wide
                ? "text-[clamp(2rem,4vw,3.35rem)]"
                : "text-[clamp(1.55rem,2.3vw,2.15rem)]"
            )}
          >
            {f.label.split(" ").map((word, index) => (
              <span
                key={`${f.word}-${word}-${index}`}
                className="inline-block"
                style={{
                  opacity: revealed ? 1 : 0,
                  transform: revealed
                    ? "translateY(0) rotate(0deg)"
                    : "translateY(115%) rotate(2deg)",
                  filter: revealed ? "blur(0px)" : "blur(5px)",
                  transition: `opacity 420ms ${EASE} ${
                    revealed ? 55 + index * 65 : 0
                  }ms, transform 520ms ${EASE} ${
                    revealed ? 55 + index * 65 : 0
                  }ms, filter 420ms ${EASE} ${
                    revealed ? 55 + index * 65 : 0
                  }ms`,
                }}
              >
                {word}
              </span>
            ))}
          </h3>
          <p
            className="mt-3 font-display text-[14px] font-bold leading-snug tracking-[-0.01em] text-ink/80 sm:text-[15px]"
            style={{
              opacity: revealed ? 1 : 0,
              transform: revealed ? "translateY(0)" : "translateY(8px)",
              transition: `opacity 420ms ${EASE} ${revealed ? 245 : 0}ms, transform 480ms ${EASE} ${revealed ? 245 : 0}ms`,
            }}
          >
            {f.headline}
          </p>
          <p
            className={cn(
              "mt-1.5 max-w-md text-[13px] leading-relaxed text-ink/65",
              !f.wide && "hidden min-[420px]:block"
            )}
            style={{
              opacity: revealed ? 1 : 0,
              transform: revealed ? "translateY(0)" : "translateY(8px)",
              transition: `opacity 420ms ${EASE} ${revealed ? 315 : 0}ms, transform 480ms ${EASE} ${revealed ? 315 : 0}ms`,
            }}
          >
            {f.body}
          </p>
        </div>

        <MosaicImage feature={f} revealed={revealed} animate={animatedReveal} />
      </div>
    </div>
  );
}

/** A grid of image fragments flies into place, then hands off to one crisp
 * Next Image. No runtime randomness means SSR/hydration always agree. */
function MosaicImage({
  feature,
  revealed,
  animate,
}: {
  feature: Feature;
  revealed: boolean;
  animate: boolean;
}) {
  const tiles = Array.from({ length: TILE_COLS * TILE_ROWS }, (_, index) => {
    const col = index % TILE_COLS;
    const row = Math.floor(index / TILE_COLS);
    const jitter = (index * 37) % 11;
    const delay = 270 + (row + col) * 24 + jitter * 7;
    const x = (col - (TILE_COLS - 1) / 2) * 10 + (jitter - 5) * 2;
    const y = 20 + row * 8 + ((index * 19) % 13);
    const rotate = ((index * 29) % 15) - 7;

    return { index, col, row, delay, x, y, rotate };
  });

  return (
    <div className="relative mt-3 min-h-0 flex-1" aria-hidden={!revealed}>
      {animate && (
        <div className="pointer-events-none absolute inset-0">
          {tiles.map((tile) => (
            <span
              key={tile.index}
              className="absolute inset-0 bg-contain bg-bottom bg-no-repeat"
              style={{
                backgroundImage: `url(${feature.img})`,
                clipPath: `inset(${(tile.row / TILE_ROWS) * 100}% ${
                  ((TILE_COLS - tile.col - 1) / TILE_COLS) * 100
                }% ${((TILE_ROWS - tile.row - 1) / TILE_ROWS) * 100}% ${
                  (tile.col / TILE_COLS) * 100
                }%)`,
                transform: `translate(${tile.x}px, ${tile.y}px) rotate(${tile.rotate}deg) scale(0.72)`,
                filter: "blur(5px)",
                opacity: 0,
                animation: `bento-tile-assemble 720ms ${EASE} ${tile.delay}ms both`,
              }}
            />
          ))}
        </div>
      )}

      <div
        className="absolute inset-0"
        style={{
          opacity: revealed ? 1 : 0,
          transform: revealed ? "translateY(0) scale(1)" : "translateY(18px) scale(0.94)",
          filter: revealed ? "blur(0px)" : "blur(6px)",
          transition: animate
            ? `opacity 300ms ${EASE} 720ms, transform 650ms ${EASE} 500ms, filter 350ms ${EASE} 650ms`
            : `opacity 240ms ${EASE}, transform 420ms ${EASE}, filter 300ms ${EASE}`,
        }}
      >
        <Image
          src={feature.img}
          alt={feature.label}
          fill
          sizes={
            feature.wide
              ? "(max-width: 768px) 100vw, 66vw"
              : "(max-width: 768px) 100vw, 33vw"
          }
          className="object-contain object-bottom"
          style={{ filter: "drop-shadow(0 14px 28px rgba(10,31,26,0.16))" }}
        />
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
