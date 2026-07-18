"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/cn";
import { Stagger, StaggerItem, useReducedMotionSafe } from "./motion-primitives";

/* ------------------------------------------------------------------ *
 * THE BENTO, product edition. Five features; at rest each card shows
 * its name as giant outlined display type on a quiet tint. Hover
 * deepens the tint, fades the nameplate, then runs a feature-specific
 * title + illustration sequence. Every sequence settles permanently into
 * the crisp image. Only the hovered card moves; dimensions never change.
 * Touch/reduced-motion show the completed state directly.
 * ------------------------------------------------------------------ */

type RevealEffect = "pixel" | "signal" | "bars" | "orbit" | "slash";

type Feature = {
  word: string;
  label: string;
  headline: string;
  body: string;
  img: string;
  /** Rest tint / hover tint. */
  tint: string;
  hoverTint: string;
  effect: RevealEffect;
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
    effect: "pixel",
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
    effect: "signal",
  },
  {
    word: "ANALYTICS",
    label: "Real-Time Analytics",
    headline: "See what is happening right now.",
    body: "Track conversations, response times, leads, conversions and revenue as they change.",
    img: "/features/analytics.webp",
    tint: "#f6f8f7",
    hoverTint: "#c1d9e7",
    effect: "bars",
  },
  {
    word: "INTEGRATIONS",
    label: "Integrations",
    headline: "Connect the tools you already use.",
    body: "Sync Nudge with calendars, payment systems, CRMs, spreadsheets and commerce platforms.",
    img: "/features/integrations.webp",
    tint: "#f6f8f7",
    hoverTint: "#d1c8e5",
    effect: "orbit",
  },
  {
    word: "GREEN TICK",
    label: "Green Tick Verification",
    headline: "Turn trust into more conversations.",
    body: "Get guidance for WhatsApp business verification and strengthen customer confidence.",
    img: "/features/green-tick.webp",
    tint: "#f6f8f7",
    hoverTint: "#bfdac5",
    effect: "slash",
  },
];

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const EFFECT_SETTLE_MS = 4700;

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
  const [settled, setSettled] = useState(false);
  const coarse = useCoarsePointer();
  const reduce = useReducedMotionSafe();
  const revealed = hov || coarse || reduce;
  // Hover-only physics (lift) stay off for touch/reduced-motion.
  const lifted = hov && !coarse && !reduce;
  const animatedReveal = lifted && !settled;

  useEffect(() => {
    if (!lifted || settled) return;
    const timer = window.setTimeout(() => setSettled(true), EFFECT_SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [lifted, settled]);

  return (
    <div
      onMouseEnter={() => {
        setSettled(false);
        setHov(true);
      }}
      onMouseLeave={() => {
        setHov(false);
        setSettled(false);
      }}
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
                ? "text-[clamp(1.1rem,2vw,1.7rem)]"
                : "text-[clamp(0.95rem,1.25vw,1.15rem)]"
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
                    : wordStartTransform(f.effect, index),
                  filter: revealed ? "blur(0px)" : "blur(5px)",
                  transition: `opacity 900ms ${EASE} ${
                    revealed ? wordDelay(f.effect, index) : 0
                  }ms, transform 1050ms ${EASE} ${
                    revealed ? wordDelay(f.effect, index) : 0
                  }ms, filter 900ms ${EASE} ${
                    revealed ? wordDelay(f.effect, index) : 0
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
              transition: `opacity 800ms ${EASE} ${revealed ? 2050 : 0}ms, transform 900ms ${EASE} ${revealed ? 2050 : 0}ms`,
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
              transition: `opacity 850ms ${EASE} ${revealed ? 2550 : 0}ms, transform 950ms ${EASE} ${revealed ? 2550 : 0}ms`,
            }}
          >
            {f.body}
          </p>
        </div>

        <FeatureImageReveal
          feature={f}
          revealed={revealed}
          animate={animatedReveal}
        />
      </div>
    </div>
  );
}

function wordDelay(effect: RevealEffect, index: number): number {
  const step: Record<RevealEffect, number> = {
    pixel: 330,
    signal: 470,
    bars: 360,
    orbit: 410,
    slash: 380,
  };
  return 180 + index * step[effect];
}

function wordStartTransform(effect: RevealEffect, index: number): string {
  const direction = index % 2 === 0 ? -1 : 1;
  switch (effect) {
    case "pixel":
      return `translate(${direction * 20}px, 26px) rotate(${direction * 6}deg) scale(0.72)`;
    case "signal":
      return "translateX(-34px) skewX(-14deg)";
    case "bars":
      return "translateY(115%) scaleY(0.35)";
    case "orbit":
      return `translate(${direction * 24}px, 18px) rotate(${direction * 18}deg) scale(0.7)`;
    case "slash":
      return `translateX(${direction * 42}px) skewX(${direction * 18}deg)`;
  }
}

/** Five finite effects, one per card. After 4.7 seconds FeatureCard unmounts
 * every effect layer, leaving only the crisp, motionless source image. */
function FeatureImageReveal({
  feature,
  revealed,
  animate,
}: {
  feature: Feature;
  revealed: boolean;
  animate: boolean;
}) {
  return (
    <div className="relative mt-3 min-h-0 flex-1" aria-hidden={!revealed}>
      {animate && <EffectLayer feature={feature} />}

      <div
        className="absolute inset-0 z-10"
        style={{
          opacity: revealed ? 1 : 0,
          transform: revealed ? "translateY(0) scale(1)" : "translateY(18px) scale(0.94)",
          filter: revealed ? "blur(0px)" : "blur(6px)",
          transition: animate
            ? `opacity 700ms ${EASE} 3150ms, transform 900ms ${EASE} 2950ms, filter 700ms ${EASE} 3100ms`
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

function EffectLayer({ feature }: { feature: Feature }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-0">
      {feature.effect === "pixel" && <PixelStorm feature={feature} />}
      {feature.effect === "signal" && <SignalBurst feature={feature} />}
      {feature.effect === "bars" && <DataBuild feature={feature} />}
      {feature.effect === "orbit" && <OrbitLock feature={feature} />}
      {feature.effect === "slash" && <SlashVerify feature={feature} />}
    </div>
  );
}

function PixelStorm({ feature }: { feature: Feature }) {
  const cols = 6;
  const rows = 4;
  return (
    <>
      {Array.from({ length: cols * rows }, (_, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const jitter = (index * 37) % 17;
        return (
          <span
            key={index}
            className="absolute inset-0 bg-contain bg-bottom bg-no-repeat"
            style={{
              backgroundImage: `url(${feature.img})`,
              clipPath: `inset(${(row / rows) * 100}% ${
                ((cols - col - 1) / cols) * 100
              }% ${((rows - row - 1) / rows) * 100}% ${(col / cols) * 100}%)`,
              transform: `translate(${(col - 2.5) * 34 + jitter * 3}px, ${
                (row - 1.5) * 46 - jitter * 2
              }px) rotate(${jitter * 7 - 52}deg) scale(0.34)`,
              filter: "blur(8px) saturate(1.5)",
              opacity: 0,
              animation: `bento-pixel-lock 2500ms ${EASE} ${
                380 + ((index * 7) % 24) * 66
              }ms both`,
            }}
          />
        );
      })}
      <span className="bento-ai-core absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full" />
    </>
  );
}

function SignalBurst({ feature }: { feature: Feature }) {
  return (
    <>
      <span
        className="bento-signal-image absolute inset-0 bg-contain bg-bottom bg-no-repeat"
        style={{ backgroundImage: `url(${feature.img})` }}
      />
      {Array.from({ length: 5 }, (_, index) => (
        <span
          key={index}
          className="bento-signal-ring absolute left-1/2 top-[62%] aspect-square w-[26%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-ink/35"
          style={{ animationDelay: `${380 + index * 430}ms` }}
        />
      ))}
      <span className="bento-signal-beam absolute bottom-[8%] left-1/2 h-[74%] w-px -translate-x-1/2 bg-white/80" />
    </>
  );
}

function DataBuild({ feature }: { feature: Feature }) {
  const columns = 11;
  return (
    <>
      <span className="bento-data-grid absolute inset-[5%] rounded-2xl" />
      {Array.from({ length: columns }, (_, index) => (
        <span
          key={index}
          className="absolute inset-0 bg-contain bg-bottom bg-no-repeat"
          style={{
            backgroundImage: `url(${feature.img})`,
            clipPath: `inset(0 ${
              ((columns - index - 1) / columns) * 100
            }% 0 ${(index / columns) * 100}%)`,
            transform: `translateY(${70 + ((index * 23) % 60)}px) scaleY(0.08)`,
            transformOrigin: "bottom",
            filter: "blur(6px) contrast(1.35)",
            opacity: 0,
            animation: `bento-data-rise 2600ms ${EASE} ${
              420 + index * 145
            }ms both`,
          }}
        />
      ))}
      <span className="bento-data-cursor absolute bottom-[6%] left-[4%] h-[2px] w-[92%] bg-white/90" />
    </>
  );
}

function OrbitLock({ feature }: { feature: Feature }) {
  const wedges = 8;
  return (
    <>
      {Array.from({ length: wedges }, (_, index) => {
        const start = -90 + index * (360 / wedges);
        const end = start + 360 / wedges + 1;
        const point = (angle: number) => {
          const radians = (angle * Math.PI) / 180;
          return `${50 + Math.cos(radians) * 76}% ${
            50 + Math.sin(radians) * 76
          }%`;
        };
        const direction = index % 2 === 0 ? -1 : 1;
        return (
          <span
            key={index}
            className="absolute inset-0 bg-contain bg-bottom bg-no-repeat"
            style={{
              backgroundImage: `url(${feature.img})`,
              clipPath: `polygon(50% 50%, ${point(start)}, ${point(end)})`,
              transform: `rotate(${direction * (95 + index * 11)}deg) scale(0.28)`,
              filter: "blur(7px) hue-rotate(22deg)",
              opacity: 0,
              animation: `bento-orbit-lock 3000ms ${EASE} ${
                360 + index * 145
              }ms both`,
            }}
          />
        );
      })}
      <span className="bento-orbit-ring bento-orbit-ring-a absolute left-1/2 top-1/2 aspect-square w-[58%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/65" />
      <span className="bento-orbit-ring bento-orbit-ring-b absolute left-1/2 top-1/2 aspect-square w-[38%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-ink/25" />
    </>
  );
}

function SlashVerify({ feature }: { feature: Feature }) {
  const bands = 8;
  return (
    <>
      {Array.from({ length: bands }, (_, index) => {
        const left = index * 13 - 18;
        const direction = index % 2 === 0 ? -1 : 1;
        return (
          <span
            key={index}
            className="absolute inset-0 bg-contain bg-bottom bg-no-repeat"
            style={{
              backgroundImage: `url(${feature.img})`,
              clipPath: `polygon(${left}% 0, ${left + 20}% 0, ${
                left + 42
              }% 100%, ${left + 22}% 100%)`,
              transform: `translateX(${direction * 120}px) skewX(-12deg)`,
              filter: "blur(6px) saturate(1.3)",
              opacity: 0,
              animation: `bento-slash-lock 2700ms ${EASE} ${
                440 + index * 175
              }ms both`,
            }}
          />
        );
      })}
      <svg
        viewBox="0 0 160 110"
        className="bento-verify-mark absolute bottom-[8%] right-[6%] w-[52%]"
        aria-hidden
      >
        <path d="M18 58 61 94 145 14" fill="none" stroke="white" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </>
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
