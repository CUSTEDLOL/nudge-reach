"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { Stagger, StaggerItem, useReducedMotionSafe } from "./motion-primitives";

/* ------------------------------------------------------------------ *
 * THE BENTO, animated — miniature edition. At rest each card is
 * silent: grey with one giant hollow word. Hover brings a soft wash
 * and a small looping diorama in the lower half of the card — a house
 * being built, dinner service, a tooth getting brushed, a lesson, a
 * makeover — sized like a model on a desk, never touching the copy.
 * Choreography: percentage-timed keyframes on one 10s cycle
 * (globals.css); scenes remount per hover so the story starts at 0;
 * reduced-motion shows the finished frame.
 * ------------------------------------------------------------------ */

/* ---------- Scene 1 · REAL ESTATE — the house goes up ------------- */
function HouseScene() {
  return (
    <svg viewBox="40 40 700 340" preserveAspectRatio="xMidYMax meet" className="mx-auto h-full w-auto max-w-full" aria-hidden>
      <g className="reb-sun">
        <circle cx="614" cy="96" r="26" fill="#f3cf7a" />
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i * Math.PI) / 4;
          return (
            <line
              key={i}
              x1={614 + Math.cos(a) * 36} y1={96 + Math.sin(a) * 36}
              x2={614 + Math.cos(a) * 45} y2={96 + Math.sin(a) * 45}
              stroke="#f3cf7a" strokeWidth="4" strokeLinecap="round"
            />
          );
        })}
      </g>
      {/* ground shadow */}
      <ellipse cx="390" cy="360" rx="180" ry="9" fill="#35544a" opacity=".18" />
      {/* crane */}
      <g className="reb-crane">
        <rect x="126" y="140" width="8" height="216" rx="3" fill="#35544a" />
        <rect x="96" y="133" width="124" height="8" rx="4" fill="#35544a" />
        <line x1="196" y1="141" x2="196" y2="176" stroke="#35544a" strokeWidth="3" />
        <rect x="186" y="176" width="20" height="15" rx="3" fill="#d9a259" />
      </g>
      {/* foundation */}
      <rect className="reb-slab" x="280" y="342" width="220" height="13" rx="4" fill="#35544a" />
      {/* storey 1 */}
      <g className="reb-wall1">
        <rect x="292" y="280" width="196" height="62" fill="#ffffff" />
        <rect className="reb-win reb-win1" x="308" y="294" width="30" height="30" rx="5" fill="#f3cf7a" />
        <rect className="reb-win reb-win2" x="442" y="294" width="30" height="30" rx="5" fill="#f3cf7a" />
        <rect className="reb-door" x="374" y="298" width="32" height="44" rx="4" fill="#3d8f6d" />
      </g>
      {/* storey 2 */}
      <g className="reb-wall2">
        <rect x="292" y="226" width="196" height="54" fill="#f2f9f5" />
        <rect className="reb-win reb-win3" x="316" y="238" width="28" height="28" rx="5" fill="#f3cf7a" />
        <rect className="reb-win reb-win4" x="436" y="238" width="28" height="28" rx="5" fill="#f3cf7a" />
      </g>
      {/* roof + chimney */}
      <g className="reb-roof">
        <path d="M278 226 L390 156 L502 226 Z" fill="#3d8f6d" />
        <rect x="446" y="168" width="19" height="40" rx="3" fill="#35544a" />
      </g>
      {/* smoke */}
      <circle className="reb-smoke reb-smoke1" cx="456" cy="158" r="7" fill="#ffffff" opacity=".7" />
      <circle className="reb-smoke reb-smoke2" cx="462" cy="158" r="5.5" fill="#ffffff" opacity=".6" />
      {/* SOLD sign */}
      <g className="reb-sold">
        <rect x="196" y="298" width="7" height="58" rx="3" fill="#35544a" />
        <rect x="164" y="272" width="72" height="34" rx="7" fill="#3d8f6d" />
        <text x="200" y="295" textAnchor="middle" fontSize="16" fontWeight="700" fill="#ffffff" fontFamily="inherit" letterSpacing="1">
          SOLD
        </text>
      </g>
    </svg>
  );
}

/* ---------- Scene 2 · RESTAURANTS — dinner service ----------------- */
function KitchenScene() {
  return (
    <svg viewBox="30 150 320 240" preserveAspectRatio="xMidYMax meet" className="mx-auto h-full w-auto max-w-full" aria-hidden>
      {/* counter */}
      <rect x="52" y="336" width="266" height="10" rx="5" fill="#a9705a" opacity=".55" />
      <ellipse cx="185" cy="362" rx="140" ry="8" fill="#a9705a" opacity=".15" />
      {/* stove */}
      <rect x="70" y="322" width="118" height="13" rx="6" fill="#5b4238" />
      {/* flames */}
      <g className="rst-flame rst-flame1"><path d="M108 320 q5 -17 10 0 q-5 7 -10 0" fill="#e8935f" /></g>
      <g className="rst-flame rst-flame2"><path d="M126 320 q5 -20 10 0 q-5 7 -10 0" fill="#eda57a" /></g>
      <g className="rst-flame rst-flame3"><path d="M144 320 q5 -15 10 0 q-5 7 -10 0" fill="#e8935f" /></g>
      {/* pan */}
      <g className="rst-pan">
        <path d="M84 300 h98 a9 9 0 0 1 -9 15 h-80 a9 9 0 0 1 -9 -15 Z" fill="#3f3a36" />
        <rect x="180" y="300" width="50" height="8" rx="4" fill="#6b625b" />
        <circle className="rst-ing rst-ing1" cx="112" cy="295" r="8.5" fill="#d96c5f" />
        <circle className="rst-ing rst-ing2" cx="133" cy="295" r="8" fill="#e8cf8e" />
        <circle className="rst-ing rst-ing3" cx="154" cy="295" r="8" fill="#9ab86a" />
      </g>
      {/* steam */}
      <path className="rst-steam rst-steam1" d="M120 276 q-7 -12 0 -22 q7 -10 0 -20" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" fill="none" opacity=".6" />
      <path className="rst-steam rst-steam2" d="M148 271 q7 -12 0 -22 q-7 -10 0 -20" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" fill="none" opacity=".45" />
      {/* plate */}
      <g className="rst-plate">
        <ellipse cx="272" cy="338" rx="44" ry="10" fill="#ffffff" />
        <ellipse cx="272" cy="334" rx="30" ry="7" fill="#f3efec" />
      </g>
      {/* the dish arcs to the plate */}
      <g className="rst-dish">
        <circle cx="0" cy="0" r="13" fill="#dd8a55" />
        <circle cx="-5" cy="-3" r="4" fill="#d96c5f" />
        <circle cx="6" cy="-2.5" r="3.5" fill="#9ab86a" />
      </g>
      {/* serve sparkle */}
      <g className="rst-spark">
        <path d="M272 284 l3.5 9 9 3.5 -9 3.5 -3.5 9 -3.5 -9 -9 -3.5 9 -3.5 Z" fill="#e8cf8e" />
        <circle cx="298" cy="304" r="3" fill="#e8cf8e" />
        <circle cx="246" cy="298" r="2.5" fill="#e8cf8e" />
      </g>
    </svg>
  );
}

/* ---------- Scene 3 · CLINICS — the happy tooth -------------------- */
function ToothScene() {
  return (
    <svg viewBox="60 90 240 220" preserveAspectRatio="xMidYMax meet" className="mx-auto h-full w-auto max-w-full" aria-hidden>
      {/* pulse line */}
      <path
        className="cli-pulse"
        d="M66 118 h44 l12 -20 15 40 12 -20 h140"
        stroke="#4f89ac" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none"
        pathLength="1"
      />
      <ellipse cx="180" cy="296" rx="86" ry="7" fill="#33627e" opacity=".13" />
      {/* tooth */}
      <g className="cli-tooth">
        <path
          d="M136 196 q0 -46 44 -46 q44 0 44 46 q0 26 -10 47 q-8 17 -14 44 q-3 12 -10 12 q-8 0 -9 -12 l-3 -26 q-1.5 -10 -6 -10 q-4.5 0 -6 10 l-3 26 q-1.5 12 -9 12 q-8 0 -10 -12 q-6 -27 -14 -44 q-10 -21 -10 -47 Z"
          fill="#ffffff" stroke="#3a6a86" strokeWidth="4.5" strokeLinejoin="round"
        />
        <circle className="cli-eye" cx="166" cy="190" r="4.5" fill="#3a6a86" />
        <circle className="cli-eye" cx="196" cy="190" r="4.5" fill="#3a6a86" />
        <path className="cli-smile" d="M162 210 q19 16 38 0" stroke="#3a6a86" strokeWidth="4.5" strokeLinecap="round" fill="none" pathLength="1" />
        <circle className="cli-blush" cx="150" cy="204" r="5" fill="#a8d4ea" opacity=".7" />
        <circle className="cli-blush" cx="210" cy="204" r="5" fill="#a8d4ea" opacity=".7" />
      </g>
      {/* toothbrush */}
      <g className="cli-brush">
        <rect x="0" y="0" width="64" height="12" rx="6" fill="#4f89ac" />
        <rect x="58" y="-8" width="26" height="20" rx="5" fill="#ffffff" stroke="#4f89ac" strokeWidth="3" />
        {Array.from({ length: 4 }).map((_, i) => (
          <line key={i} x1={63 + i * 5.4} y1="-8" x2={63 + i * 5.4} y2="12" stroke="#bcdcee" strokeWidth="2.5" />
        ))}
      </g>
      {/* sparkles */}
      <g className="cli-spark cli-spark1"><path d="M136 148 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3 Z" fill="#8fc4de" /></g>
      <g className="cli-spark cli-spark2"><path d="M228 142 l2.6 7 7 2.6 -7 2.6 -2.6 7 -2.6 -7 -7 -2.6 7 -2.6 Z" fill="#a8d4ea" /></g>
      <g className="cli-spark cli-spark3"><circle cx="238" cy="176" r="4" fill="#8fc4de" /></g>
    </svg>
  );
}

/* ---------- Scene 4 · SCHOOLS — the lesson ------------------------- */
function LessonScene() {
  return (
    <svg viewBox="30 80 320 240" preserveAspectRatio="xMidYMax meet" className="mx-auto h-full w-auto max-w-full" aria-hidden>
      <ellipse cx="180" cy="306" rx="130" ry="7" fill="#4b3f7a" opacity=".13" />
      <rect x="52" y="296" width="256" height="9" rx="4.5" fill="#6b5aa8" opacity=".5" />
      {/* book */}
      <g className="sch-book">
        <path d="M80 292 q50 -18 100 0 l0 -110 q-50 -18 -100 0 Z" fill="#ffffff" stroke="#6b5aa8" strokeWidth="4" strokeLinejoin="round" />
        <path d="M280 292 q-50 -18 -100 0 l0 -110 q50 -18 100 0 Z" fill="#f6f4fb" stroke="#6b5aa8" strokeWidth="4" strokeLinejoin="round" />
        <path className="sch-line" d="M100 218 q32 -10 68 -2" stroke="#8d7cc4" strokeWidth="4" strokeLinecap="round" fill="none" pathLength="1" />
        <path className="sch-line sch-line2" d="M100 240 q32 -10 68 -2" stroke="#b9aede" strokeWidth="4" strokeLinecap="round" fill="none" pathLength="1" />
      </g>
      {/* pencil */}
      <g className="sch-pencil">
        <rect x="-6" y="-42" width="11" height="36" rx="3.5" fill="#d9a259" transform="rotate(32)" />
        <path d="M0 0 l8 -11 3 9.5 Z" transform="rotate(32)" fill="#8a5f38" />
      </g>
      {/* A+ stamp */}
      <g className="sch-grade">
        <circle cx="248" cy="204" r="27" fill="#6b5aa8" />
        <text x="248" y="213" textAnchor="middle" fontSize="25" fontWeight="700" fill="#ffffff" fontFamily="inherit">A+</text>
      </g>
      {/* graduation cap */}
      <g className="sch-cap">
        <path d="M136 134 l48 -19 48 19 -48 19 Z" fill="#3c3660" />
        <path d="M162 145 l0 20 q22 11 44 0 l0 -20" fill="none" stroke="#3c3660" strokeWidth="8" />
        <line x1="230" y1="134" x2="230" y2="158" stroke="#d9a259" strokeWidth="3" />
        <circle cx="230" cy="161" r="4" fill="#d9a259" />
      </g>
      {/* stars */}
      <g className="sch-star sch-star1"><path d="M96 132 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4 Z" fill="#a08fd0" /></g>
      <g className="sch-star sch-star2"><path d="M282 112 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3 Z" fill="#b9aede" /></g>
    </svg>
  );
}

/* ---------- Scene 5 · SALONS — the makeover ------------------------ */
function SalonScene() {
  return (
    <svg viewBox="50 60 260 300" preserveAspectRatio="xMidYMax meet" className="mx-auto h-full w-auto max-w-full" aria-hidden>
      {/* mirror */}
      <g className="sal-mirror">
        <ellipse cx="180" cy="180" rx="82" ry="100" fill="#fdf7e8" stroke="#a8834e" strokeWidth="5" />
        <ellipse cx="180" cy="180" rx="67" ry="85" fill="#f8eecf" />
        <rect className="sal-shine" x="-40" y="60" width="26" height="240" fill="#ffffff" opacity=".45" transform="rotate(24 180 180)" />
      </g>
      <ellipse cx="180" cy="348" rx="100" ry="7" fill="#8a6a3a" opacity=".14" />
      {/* dotted cut line */}
      <line x1="110" y1="322" x2="250" y2="322" stroke="#a8834e" strokeWidth="2.5" strokeDasharray="2 9" strokeLinecap="round" />
      {/* falling hair strands */}
      <path className="sal-hair sal-hair1" d="M132 326 q5 8 -2 16" stroke="#7a5a3a" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path className="sal-hair sal-hair2" d="M176 326 q-5 8 2 16" stroke="#96744c" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path className="sal-hair sal-hair3" d="M218 326 q5 8 -2 14" stroke="#7a5a3a" strokeWidth="3" strokeLinecap="round" fill="none" />
      {/* scissors */}
      <g className="sal-scissors">
        <g className="sal-blade sal-bladeA">
          <path d="M0 0 L34 -9" stroke="#6e675f" strokeWidth="5.5" strokeLinecap="round" />
        </g>
        <g className="sal-blade sal-bladeB">
          <path d="M0 0 L34 9" stroke="#8a827a" strokeWidth="5.5" strokeLinecap="round" />
        </g>
        <circle cx="-7" cy="-7" r="6" fill="none" stroke="#a8834e" strokeWidth="4" />
        <circle cx="-7" cy="7" r="6" fill="none" stroke="#a8834e" strokeWidth="4" />
      </g>
      {/* sparkles */}
      <g className="sal-spark sal-spark1"><path d="M156 156 l4 9 9 4 -9 4 -4 9 -4 -9 -9 -4 9 -4 Z" fill="#d9b464" /></g>
      <g className="sal-spark sal-spark2"><path d="M206 138 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3 Z" fill="#e3c47e" /></g>
      <g className="sal-spark sal-spark3"><circle cx="214" cy="206" r="4.5" fill="#e3c47e" /></g>
      {/* bloom heart */}
      <path
        className="sal-heart"
        d="M180 216 q-3 -9 -12 -9 q-12 0 -12 12 q0 14 24 26 q24 -12 24 -26 q0 -12 -12 -12 q-9 0 -12 9 Z"
        fill="#d98a94"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */

type Scene = {
  word: string;
  eyebrow: string;
  title: string;
  sub: string;
  theme: string;
  accent: string;
  art: React.ReactNode;
  wide?: boolean;
};

const SCENES: Scene[] = [
  {
    word: "REAL ESTATE",
    eyebrow: "Real estate",
    title: "Chases every lead.",
    sub: "Until the deal closes.",
    theme: "linear-gradient(165deg, #eef7f2 0%, #ddefe6 100%)",
    accent: "#2f7a58",
    art: <HouseScene />,
    wide: true,
  },
  {
    word: "SCHOOLS",
    eyebrow: "Schools & institutions",
    title: "Replies in seconds.",
    sub: "Before the next place does.",
    theme: "linear-gradient(165deg, #f2effa 0%, #e5dff4 100%)",
    accent: "#6650a8",
    art: <LessonScene />,
  },
  {
    word: "CLINICS",
    eyebrow: "Dental, clinics & hospitals",
    title: "Cuts the no-shows.",
    sub: "A reminder the evening before.",
    theme: "linear-gradient(165deg, #eef5fa 0%, #ddebf5 100%)",
    accent: "#33627e",
    art: <ToothScene />,
  },
  {
    word: "RESTAURANTS",
    eyebrow: "Restaurants & cafés",
    title: "Fills every table.",
    sub: "Even at full tilt.",
    theme: "linear-gradient(165deg, #faf2ea 0%, #f4e4d4 100%)",
    accent: "#a05f36",
    art: <KitchenScene />,
  },
  {
    word: "SALONS",
    eyebrow: "Salons & spas",
    title: "Takes the deposit.",
    sub: "Locks the chair, cuts no-shows.",
    theme: "linear-gradient(165deg, #faf5e8 0%, #f2e8ce 100%)",
    accent: "#8a6a33",
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
            ? "0 28px 56px -34px rgba(10,31,26,0.28)"
            : "0 16px 36px -30px rgba(10,31,26,0.18)",
        } as CSSProperties
      }
    >
      {/* soft wash */}
      <div
        aria-hidden
        className="absolute inset-0 transition-opacity duration-500"
        style={{ background: scene.theme, opacity: engaged ? 1 : 0 }}
      />

      {/* miniature diorama — confined to the lower half, clear of the copy */}
      {engaged && (
        <div
          className={cn(
            "story-scene absolute inset-x-0 bottom-0 h-[54%] px-6 pb-5",
            reduce && "story-done"
          )}
        >
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

      {/* copy — owns the top of the card */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 p-6 transition-all duration-500 sm:p-7",
          engaged ? "opacity-100" : "translate-y-2 opacity-0"
        )}
      >
        <span
          className="font-mono text-[10px] font-bold uppercase tracking-[0.2em]"
          style={{ color: scene.accent }}
        >
          {scene.eyebrow}
        </span>
        <h3 className="mt-2 font-display text-[1.4rem] font-black leading-tight tracking-[-0.02em] text-ink sm:text-[1.55rem]">
          {scene.title}
        </h3>
        <p className="mt-1 text-[13px] font-medium text-ink/50">{scene.sub}</p>
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
