"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { Stagger, StaggerItem, useReducedMotionSafe } from "./motion-primitives";

/* ------------------------------------------------------------------ *
 * THE BENTO, animated. At rest each card is silent: grey with one
 * giant hollow word. Hover floods the trade's colour in and mounts a
 * 10-second looping SVG story that fills the card — a house being
 * built, dinner service, a tooth getting brushed, a lesson, a
 * makeover. Scenes remount on every hover so the story always starts
 * from the beginning. Choreography lives in globals.css keyframes
 * (percentage-timed on one 10s cycle); reduced-motion shows the
 * finished scene.
 * ------------------------------------------------------------------ */

/* ---------- Scene 1 · REAL ESTATE — the house goes up ------------- */
function HouseScene() {
  return (
    <svg viewBox="0 0 720 400" preserveAspectRatio="xMidYMax slice" className="h-full w-full" aria-hidden>
      {/* sun */}
      <g className="reb-sun">
        <circle cx="614" cy="86" r="34" fill="#ffd968" />
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i * Math.PI) / 4;
          return (
            <line
              key={i}
              x1={614 + Math.cos(a) * 46} y1={86 + Math.sin(a) * 46}
              x2={614 + Math.cos(a) * 58} y2={86 + Math.sin(a) * 58}
              stroke="#ffd968" strokeWidth="5" strokeLinecap="round"
            />
          );
        })}
      </g>
      {/* ground */}
      <rect x="0" y="356" width="720" height="44" fill="#07261c" opacity=".85" />
      {/* crane */}
      <g className="reb-crane">
        <rect x="96" y="120" width="10" height="236" rx="3" fill="#07261c" />
        <rect x="60" y="112" width="150" height="10" rx="4" fill="#07261c" />
        <line x1="180" y1="122" x2="180" y2="164" stroke="#07261c" strokeWidth="4" />
        <rect x="168" y="164" width="24" height="18" rx="3" fill="#f59e0b" />
      </g>
      {/* foundation */}
      <rect className="reb-slab" x="270" y="340" width="240" height="16" rx="4" fill="#07261c" />
      {/* storey 1 */}
      <g className="reb-wall1">
        <rect x="282" y="272" width="216" height="68" fill="#ffffff" />
        <rect className="reb-win reb-win1" x="300" y="288" width="34" height="34" rx="5" fill="#ffd968" />
        <rect className="reb-win reb-win2" x="446" y="288" width="34" height="34" rx="5" fill="#ffd968" />
        <rect className="reb-door" x="372" y="292" width="36" height="48" rx="4" fill="#0a643c" />
      </g>
      {/* storey 2 */}
      <g className="reb-wall2">
        <rect x="282" y="212" width="216" height="60" fill="#ecfdf3" />
        <rect className="reb-win reb-win3" x="310" y="226" width="32" height="32" rx="5" fill="#ffd968" />
        <rect className="reb-win reb-win4" x="438" y="226" width="32" height="32" rx="5" fill="#ffd968" />
      </g>
      {/* roof + chimney */}
      <g className="reb-roof">
        <path d="M266 212 L390 132 L514 212 Z" fill="#0a643c" />
        <rect x="452" y="146" width="22" height="46" rx="3" fill="#07261c" />
      </g>
      {/* smoke */}
      <circle className="reb-smoke reb-smoke1" cx="463" cy="136" r="9" fill="#ffffff" opacity=".8" />
      <circle className="reb-smoke reb-smoke2" cx="470" cy="136" r="7" fill="#ffffff" opacity=".7" />
      {/* SOLD sign */}
      <g className="reb-sold">
        <rect x="176" y="286" width="8" height="70" rx="3" fill="#07261c" />
        <rect x="140" y="258" width="84" height="40" rx="8" fill="#06c167" />
        <text x="182" y="285" textAnchor="middle" fontSize="19" fontWeight="800" fill="#ffffff" fontFamily="inherit" letterSpacing="1">
          SOLD
        </text>
      </g>
    </svg>
  );
}

/* ---------- Scene 2 · RESTAURANTS — dinner service ----------------- */
function KitchenScene() {
  return (
    <svg viewBox="0 0 360 400" preserveAspectRatio="xMidYMax slice" className="h-full w-full" aria-hidden>
      {/* counter */}
      <rect x="0" y="330" width="360" height="70" fill="#7c2d12" opacity=".9" />
      {/* stove */}
      <rect x="60" y="318" width="130" height="14" rx="6" fill="#431407" />
      {/* flames */}
      <g className="rst-flame rst-flame1"><path d="M104 316 q6 -20 12 0 q-6 8 -12 0" fill="#f97316" /></g>
      <g className="rst-flame rst-flame2"><path d="M126 316 q6 -24 12 0 q-6 8 -12 0" fill="#fb923c" /></g>
      <g className="rst-flame rst-flame3"><path d="M148 316 q6 -18 12 0 q-6 8 -12 0" fill="#f97316" /></g>
      {/* pan */}
      <g className="rst-pan">
        <path d="M78 296 h112 a10 10 0 0 1 -10 16 h-92 a10 10 0 0 1 -10 -16 Z" fill="#1c1917" />
        <rect x="186" y="296" width="58" height="9" rx="4.5" fill="#44403c" />
        {/* food in the pan */}
        <circle className="rst-ing rst-ing1" cx="110" cy="290" r="10" fill="#ef4444" />
        <circle className="rst-ing rst-ing2" cx="134" cy="290" r="9" fill="#fde68a" />
        <circle className="rst-ing rst-ing3" cx="158" cy="290" r="9" fill="#84cc16" />
      </g>
      {/* steam */}
      <path className="rst-steam rst-steam1" d="M118 268 q-8 -14 0 -26 q8 -12 0 -24" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" fill="none" opacity=".7" />
      <path className="rst-steam rst-steam2" d="M150 262 q8 -14 0 -26 q-8 -12 0 -24" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" fill="none" opacity=".55" />
      {/* plate */}
      <g className="rst-plate">
        <ellipse cx="278" cy="336" rx="52" ry="12" fill="#ffffff" />
        <ellipse cx="278" cy="332" rx="36" ry="8" fill="#f5f5f4" />
      </g>
      {/* the dish arcs to the plate */}
      <g className="rst-dish">
        <circle cx="0" cy="0" r="16" fill="#f97316" />
        <circle cx="-6" cy="-4" r="5" fill="#ef4444" />
        <circle cx="7" cy="-3" r="4" fill="#84cc16" />
      </g>
      {/* serve sparkle */}
      <g className="rst-spark">
        <path d="M278 268 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4 Z" fill="#ffd968" />
        <circle cx="308" cy="292" r="4" fill="#ffd968" />
        <circle cx="248" cy="284" r="3" fill="#ffd968" />
      </g>
    </svg>
  );
}

/* ---------- Scene 3 · CLINICS — the happy tooth -------------------- */
function ToothScene() {
  return (
    <svg viewBox="0 0 360 400" preserveAspectRatio="xMidYMid slice" className="h-full w-full" aria-hidden>
      {/* pulse line */}
      <path
        className="cli-pulse"
        d="M20 122 h70 l16 -26 20 52 16 -26 h198"
        stroke="#0369a1" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none"
        pathLength="1"
      />
      {/* tooth */}
      <g className="cli-tooth">
        <path
          d="M120 190 q0 -60 60 -60 q60 0 60 60 q0 34 -14 62 q-10 22 -18 58 q-4 16 -14 16 q-10 0 -12 -16 l-4 -34 q-2 -14 -8 -14 q-6 0 -8 14 l-4 34 q-2 16 -12 16 q-10 0 -14 -16 q-8 -36 -18 -58 q-14 -28 -14 -62 Z"
          fill="#ffffff" stroke="#0c4a6e" strokeWidth="6" strokeLinejoin="round"
        />
        {/* eyes */}
        <circle className="cli-eye" cx="160" cy="182" r="6" fill="#0c4a6e" />
        <circle className="cli-eye" cx="200" cy="182" r="6" fill="#0c4a6e" />
        {/* smile draws in */}
        <path className="cli-smile" d="M154 208 q26 22 52 0" stroke="#0c4a6e" strokeWidth="6" strokeLinecap="round" fill="none" pathLength="1" />
        {/* blush */}
        <circle className="cli-blush" cx="140" cy="200" r="7" fill="#7dd3fc" opacity=".7" />
        <circle className="cli-blush" cx="220" cy="200" r="7" fill="#7dd3fc" opacity=".7" />
      </g>
      {/* toothbrush */}
      <g className="cli-brush">
        <rect x="0" y="0" width="86" height="16" rx="8" fill="#0284c7" />
        <rect x="78" y="-10" width="34" height="26" rx="6" fill="#ffffff" stroke="#0284c7" strokeWidth="4" />
        {Array.from({ length: 4 }).map((_, i) => (
          <line key={i} x1={84 + i * 7} y1="-10" x2={84 + i * 7} y2="16" stroke="#bae6fd" strokeWidth="3" />
        ))}
      </g>
      {/* sparkles */}
      <g className="cli-spark cli-spark1"><path d="M120 130 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4 Z" fill="#38bdf8" /></g>
      <g className="cli-spark cli-spark2"><path d="M236 122 l3.5 9 9 3.5 -9 3.5 -3.5 9 -3.5 -9 -9 -3.5 9 -3.5 Z" fill="#7dd3fc" /></g>
      <g className="cli-spark cli-spark3"><circle cx="250" cy="168" r="5" fill="#38bdf8" /></g>
    </svg>
  );
}

/* ---------- Scene 4 · SCHOOLS — the lesson ------------------------- */
function LessonScene() {
  return (
    <svg viewBox="0 0 360 400" preserveAspectRatio="xMidYMid slice" className="h-full w-full" aria-hidden>
      {/* desk */}
      <rect x="30" y="300" width="300" height="12" rx="6" fill="#4c1d95" opacity=".85" />
      {/* book */}
      <g className="sch-book">
        <path d="M60 296 q60 -22 120 0 l0 -132 q-60 -22 -120 0 Z" fill="#ffffff" stroke="#6d28d9" strokeWidth="5" strokeLinejoin="round" />
        <path d="M300 296 q-60 -22 -120 0 l0 -132 q60 -22 120 0 Z" fill="#f5f3ff" stroke="#6d28d9" strokeWidth="5" strokeLinejoin="round" />
        {/* the written line draws as the pencil moves */}
        <path className="sch-line" d="M84 210 q40 -12 84 -2" stroke="#8b5cf6" strokeWidth="5" strokeLinecap="round" fill="none" pathLength="1" />
        <path className="sch-line sch-line2" d="M84 236 q40 -12 84 -2" stroke="#c4b5fd" strokeWidth="5" strokeLinecap="round" fill="none" pathLength="1" />
      </g>
      {/* pencil */}
      <g className="sch-pencil">
        <rect x="-8" y="-52" width="14" height="44" rx="4" fill="#f59e0b" transform="rotate(32)" />
        <path d="M0 0 l10 -14 4 12 Z" transform="rotate(32)" fill="#7c2d12" />
      </g>
      {/* A+ stamp */}
      <g className="sch-grade">
        <circle cx="262" cy="196" r="34" fill="#8b5cf6" />
        <text x="262" y="208" textAnchor="middle" fontSize="32" fontWeight="800" fill="#ffffff" fontFamily="inherit">A+</text>
      </g>
      {/* graduation cap */}
      <g className="sch-cap">
        <path d="M130 118 l60 -24 60 24 -60 24 Z" fill="#1e1b4b" />
        <path d="M162 132 l0 26 q28 14 56 0 l0 -26" fill="none" stroke="#1e1b4b" strokeWidth="10" />
        <line x1="250" y1="118" x2="250" y2="150" stroke="#f59e0b" strokeWidth="4" />
        <circle cx="250" cy="154" r="5" fill="#f59e0b" />
      </g>
      {/* stars */}
      <g className="sch-star sch-star1"><path d="M84 120 l5 12 12 5 -12 5 -5 12 -5 -12 -12 -5 12 -5 Z" fill="#a78bfa" /></g>
      <g className="sch-star sch-star2"><path d="M292 96 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4 Z" fill="#c4b5fd" /></g>
    </svg>
  );
}

/* ---------- Scene 5 · SALONS — the makeover ------------------------ */
function SalonScene() {
  return (
    <svg viewBox="0 0 360 400" preserveAspectRatio="xMidYMid slice" className="h-full w-full" aria-hidden>
      {/* mirror */}
      <g className="sal-mirror">
        <ellipse cx="180" cy="180" rx="104" ry="128" fill="#fffbeb" stroke="#b45309" strokeWidth="7" />
        <ellipse cx="180" cy="180" rx="86" ry="110" fill="#fef3c7" />
        {/* shine sweep */}
        <rect className="sal-shine" x="-40" y="40" width="34" height="300" fill="#ffffff" opacity=".55" transform="rotate(24 180 180)" />
      </g>
      {/* dotted cut line */}
      <line x1="92" y1="332" x2="268" y2="332" stroke="#b45309" strokeWidth="3" strokeDasharray="2 10" strokeLinecap="round" />
      {/* falling hair strands */}
      <path className="sal-hair sal-hair1" d="M120 336 q6 10 -2 20" stroke="#78350f" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path className="sal-hair sal-hair2" d="M170 336 q-6 10 2 20" stroke="#92400e" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path className="sal-hair sal-hair3" d="M220 336 q6 10 -2 18" stroke="#78350f" strokeWidth="4" strokeLinecap="round" fill="none" />
      {/* scissors travel the line */}
      <g className="sal-scissors">
        <g className="sal-blade sal-bladeA">
          <path d="M0 0 L44 -12" stroke="#57534e" strokeWidth="7" strokeLinecap="round" />
        </g>
        <g className="sal-blade sal-bladeB">
          <path d="M0 0 L44 12" stroke="#78716c" strokeWidth="7" strokeLinecap="round" />
        </g>
        <circle cx="-8" cy="-9" r="8" fill="none" stroke="#b45309" strokeWidth="5" />
        <circle cx="-8" cy="9" r="8" fill="none" stroke="#b45309" strokeWidth="5" />
      </g>
      {/* sparkles in the mirror */}
      <g className="sal-spark sal-spark1"><path d="M150 150 l5 12 12 5 -12 5 -5 12 -5 -12 -12 -5 12 -5 Z" fill="#f59e0b" /></g>
      <g className="sal-spark sal-spark2"><path d="M212 128 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4 Z" fill="#fbbf24" /></g>
      <g className="sal-spark sal-spark3"><circle cx="222" cy="212" r="6" fill="#fbbf24" /></g>
      {/* bloom heart */}
      <path
        className="sal-heart"
        d="M180 232 q-4 -12 -16 -12 q-16 0 -16 16 q0 18 32 34 q32 -16 32 -34 q0 -16 -16 -16 q-12 0 -16 12 Z"
        fill="#f43f5e"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */

type Scene = {
  word: string;
  eyebrow: string;
  title: string;
  theme: string;
  accent: string;
  art: React.ReactNode;
  wide?: boolean;
};

const SCENES: Scene[] = [
  {
    word: "REAL ESTATE",
    eyebrow: "Real estate",
    title: "Chases every lead until the deal closes.",
    theme: "linear-gradient(160deg, #aee6c9 0%, #7fd8ab 60%, #5ecc97 100%)",
    accent: "#047f48",
    art: <HouseScene />,
    wide: true,
  },
  {
    word: "SCHOOLS",
    eyebrow: "Schools & institutions",
    title: "Replies before the next place does.",
    theme: "linear-gradient(160deg, #d5c8f7 0%, #b9a3f2 60%, #a488ee 100%)",
    accent: "#5b21b6",
    art: <LessonScene />,
  },
  {
    word: "CLINICS",
    eyebrow: "Dental, clinics & hospitals",
    title: "Cuts the no-shows.",
    theme: "linear-gradient(160deg, #bfe0f7 0%, #93cdf3 60%, #6fbdf0 100%)",
    accent: "#075985",
    art: <ToothScene />,
  },
  {
    word: "RESTAURANTS",
    eyebrow: "Restaurants & cafés",
    title: "Fills every table.",
    theme: "linear-gradient(160deg, #fbd3a4 0%, #f8bd7d 60%, #f5aa5c 100%)",
    accent: "#9a3412",
    art: <KitchenScene />,
  },
  {
    word: "SALONS",
    eyebrow: "Salons & spas",
    title: "Takes the deposit, locks the chair.",
    theme: "linear-gradient(160deg, #f7e3a1 0%, #f2d478 60%, #edc457 100%)",
    accent: "#92400e",
    art: <SalonScene />,
  },
];

/** Shared "(hover: none)" subscription — phones play without a cursor. */
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

function SceneCard({ scene }: { scene: Scene }) {
  const [hov, setHov] = useState(false);
  const coarse = useCoarsePointer();
  const reduce = useReducedMotionSafe();
  const engaged = hov || coarse || reduce;

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      className="relative h-full min-h-[24rem] overflow-hidden rounded-3xl border border-black/[0.05] bg-[#f5f5f7] transition-shadow duration-500"
      style={
        {
          "--c1": scene.accent,
          boxShadow: engaged
            ? "0 34px 64px -34px rgba(10,31,26,0.38)"
            : "0 16px 36px -30px rgba(10,31,26,0.18)",
        } as CSSProperties
      }
    >
      {/* theme flood */}
      <div
        aria-hidden
        className="absolute inset-0 transition-opacity duration-500"
        style={{ background: scene.theme, opacity: engaged ? 1 : 0 }}
      />

      {/* the story — remounts on every hover so it plays from the top */}
      {engaged && (
        <div className={cn("story-scene absolute inset-0", reduce && "story-done")}>
          {scene.art}
        </div>
      )}

      {/* resting nameplate */}
      <div
        aria-hidden
        className="absolute inset-0 grid place-items-center px-6 transition-all duration-500"
        style={{
          opacity: engaged ? 0 : 1,
          transform: engaged ? "translateY(-14px) scale(0.94)" : "none",
        }}
      >
        <span
          className={cn(
            "select-none text-center font-display font-black uppercase leading-[0.95] tracking-[-0.02em] text-transparent",
            scene.wide
              ? "text-[clamp(2.2rem,4.8vw,3.6rem)]"
              : "text-[clamp(1.6rem,2.6vw,2.4rem)]"
          )}
          style={{ WebkitTextStroke: "1.5px rgba(10,15,13,0.22)" }}
        >
          {scene.word}
        </span>
      </div>

      {/* title overlay */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 p-5 transition-all duration-500 sm:p-6",
          engaged ? "opacity-100" : "translate-y-2 opacity-0"
        )}
      >
        <span
          className="rounded-full px-3 py-1 font-mono text-[9.5px] font-bold uppercase tracking-[0.18em] text-white"
          style={{ backgroundColor: scene.accent }}
        >
          {scene.eyebrow}
        </span>
        <h3
          className="mt-2.5 max-w-xs font-display text-[1.35rem] font-black leading-tight tracking-[-0.02em] sm:text-[1.5rem]"
          style={{ color: scene.accent }}
        >
          {scene.title}
        </h3>
      </div>
    </div>
  );
}

export function FeatureScenes() {
  return (
    <Stagger className="mx-auto mt-14 grid max-w-6xl grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
      {SCENES.map((scene) => (
        <StaggerItem
          key={scene.word}
          className={cn("h-full", scene.wide && "md:col-span-2")}
        >
          <SceneCard scene={scene} />
        </StaggerItem>
      ))}
    </Stagger>
  );
}
