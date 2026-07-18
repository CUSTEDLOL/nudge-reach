"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import { cn } from "@/lib/cn";
import { Stagger, StaggerItem, useReducedMotionSafe } from "./motion-primitives";

/* ------------------------------------------------------------------ *
 * THE BENTO, product edition. At rest: giant outlined display words on
 * quiet tints inside visible card boundaries. Hover runs ONE finite,
 * per-feature sequence (~4.2s): title entrance → copy → a signature
 * act that expresses the feature → the crisp image resolves → every
 * decor layer fades to nothing. All motion is one-shot CSS keyframes
 * with `both` fill, and the decor layer is unmounted after the
 * sequence — a settled card is provably motionless. Leaving a card
 * unmounts everything so the sequence replays cleanly next hover.
 * Touch and reduced-motion get the completed state directly.
 * ------------------------------------------------------------------ */

type Sig = "focus" | "transmit" | "measure" | "connect" | "approve";

type Feature = {
  word: string;
  label: string;
  headline: string;
  body: string;
  img: string;
  tint: string;
  hoverTint: string;
  sig: Sig;
  /** Accent for this card's decor strokes. */
  accent: string;
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
    hoverTint: "#d9ecdf",
    sig: "focus",
    accent: "#2f7a58",
    wide: true,
  },
  {
    word: "BROADCAST",
    label: "Broadcast Marketing",
    headline: "Reach every customer at once.",
    body: "Create targeted WhatsApp campaigns, segment audiences and track delivery and engagement.",
    img: "/features/broadcast.webp",
    tint: "#f6f8f7",
    hoverTint: "#ecdcbb",
    sig: "transmit",
    accent: "#8a6a33",
  },
  {
    word: "ANALYTICS",
    label: "Real-Time Analytics",
    headline: "See what is happening right now.",
    body: "Track conversations, response times, leads, conversions and revenue as they change.",
    img: "/features/analytics.webp",
    tint: "#f6f8f7",
    hoverTint: "#d3e5f1",
    sig: "measure",
    accent: "#33627e",
  },
  {
    word: "INTEGRATIONS",
    label: "Integrations",
    headline: "Connect the tools you already use.",
    body: "Sync Nudge with calendars, payment systems, CRMs, spreadsheets and commerce platforms.",
    img: "/features/integrations.webp",
    tint: "#f6f8f7",
    hoverTint: "#ded4ef",
    sig: "connect",
    accent: "#6650a8",
  },
  {
    word: "GREEN TICK",
    label: "Green Tick Verification",
    headline: "Turn trust into more conversations.",
    body: "Get guidance for WhatsApp business verification and strengthen customer confidence.",
    img: "/features/green-tick.webp",
    tint: "#f6f8f7",
    hoverTint: "#d7e8da",
    sig: "approve",
    accent: "#2f7a58",
  },
];

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
/** Sequence length; after this the decor layer unmounts (hard stillness). */
const SETTLE_MS = 4600;

const TITLE_ANIM: Record<Sig, string> = {
  focus: `fsig-title-focus 700ms ${EASE} 200ms both`,
  transmit: `fsig-title-track 750ms ${EASE} 200ms both`,
  measure: `fsig-title-wipe 700ms ${EASE} 200ms both`,
  connect: `fsig-title-dock 700ms ${EASE} 200ms both`,
  approve: `fsig-title-stamp 600ms ${EASE} 200ms both`,
};

const IMAGE_ANIM: Record<Sig, string> = {
  focus: `fsig-img-focus 2200ms ${EASE} 1200ms both`,
  transmit: `fsig-img-radial 1900ms ${EASE} 1300ms both`,
  measure: `fsig-img-rise-clip 1800ms ${EASE} 1400ms both`,
  connect: `fsig-img-dock 1500ms ${EASE} 1900ms both`,
  approve: `fsig-img-review 700ms ${EASE} 600ms both, fsig-img-approve 900ms ${EASE} 2500ms both`,
};

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

/* ---- signature decor layers (all finite; parent fades them out) --- */

function FocusDecor({ accent }: { accent: string }) {
  // Synapse lines converge on the thought as it sharpens.
  return (
    <svg viewBox="0 0 400 300" className="absolute inset-0 h-full w-full" aria-hidden>
      {[
        "M30 60 L150 128 L200 150",
        "M370 52 L258 122 L200 150",
        "M60 268 L152 190 L200 150",
        "M348 262 L252 188 L200 150",
      ].map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke={accent}
          strokeWidth="1.5"
          strokeOpacity="0.55"
          pathLength="1"
          strokeDasharray="1"
          strokeDashoffset="1"
          style={{ animation: `fsig-draw 1100ms ${EASE} ${450 + i * 220}ms both` }}
        />
      ))}
      {[
        [30, 60],
        [370, 52],
        [60, 268],
        [348, 262],
      ].map(([cx, cy], i) => (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r="4"
          fill={accent}
          style={{
            opacity: 0,
            transformOrigin: `${cx}px ${cy}px`,
            animation: `fsig-pop 450ms ${EASE} ${380 + i * 220}ms both`,
          }}
        />
      ))}
    </svg>
  );
}

function TransmitDecor({ accent }: { accent: string }) {
  // Three rings, one transmission, from where the tablet stands.
  return (
    <>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="absolute left-[63%] top-[55%] aspect-square w-[46%] rounded-full border-2"
          style={{
            borderColor: accent,
            opacity: 0,
            animation: `fsig-ring 1200ms ${EASE} ${500 + i * 380}ms both`,
          }}
        />
      ))}
    </>
  );
}

function MeasureDecor({ accent }: { accent: string }) {
  // A baseline draws, then one measuring rule climbs with the reveal.
  return (
    <>
      <span
        className="absolute inset-x-[6%] bottom-0 h-[2px] origin-left rounded-full"
        style={{
          backgroundColor: accent,
          opacity: 0.6,
          animation: `fsig-baseline 700ms ${EASE} 500ms both, fsig-gone 500ms ${EASE} 3300ms both`,
        }}
      />
      <span
        className="absolute inset-x-[6%] h-[1.5px] rounded-full"
        style={{
          backgroundColor: accent,
          animation: `fsig-rule-climb 1800ms ${EASE} 1350ms both`,
        }}
      />
    </>
  );
}

function ConnectDecor({ accent }: { accent: string }) {
  // Two ports; the link draws left to right; a pulse confirms; then gone.
  return (
    <svg viewBox="0 0 400 60" className="absolute inset-x-0 top-[4%] h-[16%] w-full" aria-hidden>
      <circle cx="36" cy="30" r="6" fill={accent} style={{ opacity: 0, transformOrigin: "36px 30px", animation: `fsig-pop 400ms ${EASE} 450ms both` }} />
      <circle cx="364" cy="30" r="6" fill={accent} style={{ opacity: 0, transformOrigin: "364px 30px", animation: `fsig-pop 400ms ${EASE} 1650ms both` }} />
      <path
        d="M44 30 H356"
        fill="none"
        stroke={accent}
        strokeWidth="2"
        strokeDasharray="1"
        strokeDashoffset="1"
        pathLength="1"
        strokeLinecap="round"
        style={{ animation: `fsig-draw 1100ms ${EASE} 650ms both` }}
      />
      <circle
        cx="364"
        cy="30"
        r="14"
        fill="none"
        stroke={accent}
        strokeWidth="1.5"
        style={{ opacity: 0, transformOrigin: "364px 30px", animation: `fsig-pop 600ms ${EASE} 1750ms both` }}
      />
    </svg>
  );
}

function ApproveDecor({ accent }: { accent: string }) {
  // The verification badge draws, approves, and withdraws.
  return (
    <svg viewBox="0 0 120 120" className="absolute right-[6%] top-[2%] w-[26%] max-w-[7.5rem]" aria-hidden>
      <circle
        cx="60"
        cy="60"
        r="46"
        fill="none"
        stroke={accent}
        strokeWidth="5"
        pathLength="1"
        strokeDasharray="1"
        strokeDashoffset="1"
        strokeLinecap="round"
        transform="rotate(-90 60 60)"
        style={{ animation: `fsig-draw 1000ms ${EASE} 1300ms both` }}
      />
      <path
        d="M38 62 L54 78 L84 44"
        fill="none"
        stroke={accent}
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength="1"
        strokeDasharray="1"
        strokeDashoffset="1"
        style={{ animation: `fsig-draw 600ms ${EASE} 2200ms both` }}
      />
    </svg>
  );
}

const DECOR: Record<Sig, (p: { accent: string }) => ReactNode> = {
  focus: FocusDecor,
  transmit: TransmitDecor,
  measure: MeasureDecor,
  connect: ConnectDecor,
  approve: ApproveDecor,
};

function FeatureCard({ f }: { f: Feature }) {
  const [hov, setHov] = useState(false);
  const [settled, setSettled] = useState(false);
  const coarse = useCoarsePointer();
  const reduce = useReducedMotionSafe();
  const revealed = hov || coarse || reduce;
  // The animated sequence runs only for real hovers; touch/reduced-motion
  // jump straight to the completed state.
  const animating = hov && !coarse && !reduce;
  const lifted = animating;
  const Decor = DECOR[f.sig];

  useEffect(() => {
    if (!animating) return;
    const t = window.setTimeout(() => setSettled(true), SETTLE_MS);
    return () => window.clearTimeout(t);
  }, [animating]);

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
          style={{ WebkitTextStroke: "1.8px rgba(10,31,26,0.55)" }}
        >
          {f.word}
        </span>
      </div>

      {/* revealed content — remounts per hover so the sequence replays */}
      {revealed && (
        <div className="relative flex h-full flex-col p-6 sm:p-7">
          <div>
            <h3
              className={cn(
                "max-w-xl font-display font-black uppercase leading-[1] tracking-[-0.02em] text-ink",
                f.wide
                  ? "text-[clamp(1rem,1.5vw,1.35rem)]"
                  : "text-[clamp(0.9rem,1.1vw,1.15rem)]"
              )}
              style={animating ? { animation: TITLE_ANIM[f.sig] } : undefined}
            >
              {f.label}
            </h3>
            <p
              className="mt-2.5 text-[14px] font-bold leading-snug tracking-[-0.01em] text-ink/80 sm:text-[15px]"
              style={
                animating
                  ? { animation: `fsig-copy-in 600ms ${EASE} 900ms both` }
                  : undefined
              }
            >
              {f.headline}
            </p>
            <p
              className={cn(
                "mt-1.5 max-w-md text-[13px] leading-relaxed text-ink/65",
                !f.wide && "hidden min-[420px]:block"
              )}
              style={
                animating
                  ? { animation: `fsig-copy-in 650ms ${EASE} 1200ms both` }
                  : undefined
              }
            >
              {f.body}
            </p>
          </div>

          {/* image + signature act */}
          <div className="relative mt-3 min-h-0 flex-1">
            {animating && !settled && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{ animation: `fsig-gone 700ms ${EASE} 3400ms both` }}
              >
                <Decor accent={f.accent} />
              </div>
            )}
            <div
              className="absolute inset-0"
              style={animating ? { animation: IMAGE_ANIM[f.sig] } : undefined}
            >
              <Image
                src={f.img}
                alt={f.label}
                fill
                sizes={
                  f.wide
                    ? "(max-width: 768px) 100vw, 66vw"
                    : "(max-width: 768px) 100vw, 33vw"
                }
                className="object-contain object-bottom"
                style={{ filter: "drop-shadow(0 14px 28px rgba(10,31,26,0.16))" }}
              />
            </div>
          </div>
        </div>
      )}
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
