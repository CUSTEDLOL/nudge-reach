"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Building2,
  Check,
  GraduationCap,
  Scissors,
  Stethoscope,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Stagger, StaggerItem, useReducedMotionSafe } from "./motion-primitives";

/* ------------------------------------------------------------------ *
 * THE BENTO, staged. At rest each card is silent: quiet grey, one
 * giant hollow word (REAL ESTATE · SALONS · …). Hover raises the
 * curtain — the trade's theme floods in, floating light orbs drift,
 * the watermark tilts in, and a real WhatsApp exchange types itself
 * out with spring physics. Touch devices play without hover;
 * reduced-motion shows the finished scene.
 * ------------------------------------------------------------------ */

type Msg = { kind: "in" | "out"; text: string };

type Scene = {
  word: string;
  eyebrow: string;
  title: string;
  sub: string;
  icon: LucideIcon;
  /** Hover wash. */
  theme: string;
  accent: string;
  thread: Msg[];
  chip: string;
  wide?: boolean;
};

const SCENES: Scene[] = [
  {
    word: "REAL ESTATE",
    eyebrow: "Real estate",
    title: "Chases every lead.",
    sub: "Until the site visit lands.",
    icon: Building2,
    theme: "linear-gradient(150deg, #dcf3e7 0%, #edf8f1 55%, #f4faf6 100%)",
    accent: "#06c167",
    thread: [
      { kind: "in", text: "Is the 2BHK in Andheri still available?" },
      { kind: "out", text: "Yes — site visit Sunday 11 AM? I'll send the pin." },
      { kind: "in", text: "Sunday works 👍" },
      { kind: "out", text: "Locked ✓ Pin coming Saturday evening." },
    ],
    chip: "Site visit scheduled",
    wide: true,
  },
  {
    word: "SCHOOLS",
    eyebrow: "Schools & institutions",
    title: "Replies in seconds.",
    sub: "Before the next place does.",
    icon: GraduationCap,
    theme: "linear-gradient(150deg, #eae3fa 0%, #f2eefb 55%, #f6f4fa 100%)",
    accent: "#8b5cf6",
    thread: [
      { kind: "in", text: "Fees for the NEET batch?" },
      { kind: "out", text: "₹45,000/year — free demo Saturday 11 AM. Reserve a seat?" },
    ],
    chip: "Demo reserved",
  },
  {
    word: "CLINICS",
    eyebrow: "Dental, clinics & hospitals",
    title: "Cuts the no-shows.",
    sub: "A reminder the evening before.",
    icon: Stethoscope,
    theme: "linear-gradient(150deg, #dcedfa 0%, #eaf3fb 55%, #f2f7fb 100%)",
    accent: "#0ea5e9",
    thread: [
      { kind: "in", text: "Can I move my cleaning to Thursday?" },
      { kind: "out", text: "Done — Thursday 6 PM ✓ I'll remind you the evening before." },
    ],
    chip: "No-show avoided",
  },
  {
    word: "RESTAURANTS",
    eyebrow: "Restaurants & cafés",
    title: "Fills every table.",
    sub: "Even at full tilt.",
    icon: UtensilsCrossed,
    theme: "linear-gradient(150deg, #fbe7d5 0%, #fdf1e6 55%, #fbf5ef 100%)",
    accent: "#f97316",
    thread: [
      { kind: "in", text: "Table for 4 tonight?" },
      { kind: "out", text: "8 PM by the window — reserved for you 🎉" },
    ],
    chip: "Table confirmed",
  },
  {
    word: "SALONS",
    eyebrow: "Salons & spas",
    title: "Takes the deposit.",
    sub: "Locks the chair, cuts no-shows.",
    icon: Scissors,
    theme: "linear-gradient(150deg, #f9eecb 0%, #fbf4de 55%, #faf7ec 100%)",
    accent: "#ca8a04",
    thread: [
      { kind: "in", text: "Any slot tomorrow evening?" },
      { kind: "out", text: "4:30 PM with Priya — ₹200 deposit link sent 🔒" },
    ],
    chip: "₹200 collected",
  },
];

const STEP_MS = 800;
const TYPING_MS = 900;

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

function Typing({ accent }: { accent: string }) {
  return (
    <div className="flex items-center gap-1 self-end rounded-2xl rounded-br-md bg-[#d9fdd3] px-3.5 py-2.5 shadow-[0_1px_2px_rgba(11,20,26,0.08)]">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-bounce rounded-full"
          style={{ animationDelay: `${i * 150}ms`, backgroundColor: `${accent}77` }}
        />
      ))}
    </div>
  );
}

/** The exchange, typed out while `playing`; `instant` renders it finished. */
function Thread({
  scene,
  playing,
  instant,
}: {
  scene: Scene;
  playing: boolean;
  instant: boolean;
}) {
  const [shown, setShown] = useState(0);
  const [typing, setTyping] = useState(false);
  const visible = instant ? scene.thread.length : shown;
  const done = visible >= scene.thread.length;

  useEffect(() => {
    if (instant) return;
    let alive = true;
    let t: ReturnType<typeof setTimeout>;
    if (!playing) {
      t = setTimeout(() => {
        if (!alive) return;
        setShown(0);
        setTyping(false);
      }, 0);
      return () => {
        alive = false;
        clearTimeout(t);
      };
    }
    const step = (i: number) => {
      if (!alive || i >= scene.thread.length) return;
      if (scene.thread[i].kind === "out") {
        setTyping(true);
        t = setTimeout(() => {
          if (!alive) return;
          setTyping(false);
          setShown(i + 1);
          t = setTimeout(() => step(i + 1), STEP_MS);
        }, TYPING_MS);
      } else {
        setShown(i + 1);
        t = setTimeout(() => step(i + 1), STEP_MS);
      }
    };
    t = setTimeout(() => step(0), 350);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [playing, scene, instant]);

  return (
    <div className="flex flex-col justify-end gap-2">
      {scene.thread.slice(0, visible).map((m, i) => (
        <motion.div
          key={i}
          layout
          initial={instant ? false : { opacity: 0, y: 12, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 440, damping: 30 }}
          className={cn(
            "max-w-[88%] rounded-2xl px-3.5 py-2 text-[12.5px] leading-snug shadow-[0_1px_2px_rgba(11,20,26,0.08)]",
            m.kind === "out"
              ? "self-end rounded-br-md bg-[#d9fdd3] text-[#111b21]"
              : "self-start rounded-bl-md bg-white text-ink/85"
          )}
        >
          {m.text}
        </motion.div>
      ))}
      <AnimatePresence>
        {typing && (
          <motion.div
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.16 }}
            className="flex flex-col"
          >
            <Typing accent={scene.accent} />
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {done && (
          <motion.div
            layout
            initial={instant ? false : { opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 380, damping: 26, delay: 0.2 }}
            className="mt-0.5 flex items-center gap-1.5 self-start pl-0.5 text-[11.5px] font-semibold text-ink/60"
          >
            <span
              className="grid h-4 w-4 place-items-center rounded-full"
              style={{ backgroundColor: "var(--c1)" }}
            >
              <Check className="h-2.5 w-2.5 text-white" aria-hidden />
            </span>
            {scene.chip}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SceneCard({ scene }: { scene: Scene }) {
  const [hov, setHov] = useState(false);
  const coarse = useCoarsePointer();
  const reduce = useReducedMotionSafe();
  const engaged = hov || coarse || reduce;
  const Icon = scene.icon;

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      className="relative h-full min-h-[23rem] overflow-hidden rounded-3xl border border-black/[0.05] bg-[#f5f5f7] transition-shadow duration-500"
      style={
        {
          "--c1": scene.accent,
          boxShadow: engaged
            ? "0 30px 60px -34px rgba(10,31,26,0.3)"
            : "0 16px 36px -30px rgba(10,31,26,0.18)",
        } as CSSProperties
      }
    >
      {/* theme wash */}
      <div
        aria-hidden
        className="absolute inset-0 transition-opacity duration-700"
        style={{ background: scene.theme, opacity: engaged ? 1 : 0 }}
      />
      {/* drifting light orbs */}
      <div
        aria-hidden
        className="absolute -left-10 top-8 h-44 w-44 rounded-full blur-3xl transition-opacity duration-700 motion-safe:animate-float"
        style={{ backgroundColor: `${scene.accent}2e`, opacity: engaged ? 1 : 0 }}
      />
      <div
        aria-hidden
        className="absolute -bottom-12 right-6 h-52 w-52 rounded-full blur-3xl transition-opacity duration-700 motion-safe:animate-float-slow"
        style={{ backgroundColor: `${scene.accent}24`, opacity: engaged ? 1 : 0 }}
      />
      {/* watermark */}
      <Icon
        aria-hidden
        className="pointer-events-none absolute -bottom-8 -right-8 h-48 w-48 transition-all duration-700"
        style={{
          color: scene.accent,
          opacity: engaged ? 0.1 : 0,
          transform: engaged
            ? "rotate(-10deg) scale(1)"
            : "rotate(4deg) scale(0.85)",
        }}
      />

      {/* the resting word — a giant hollow nameplate */}
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

      {/* the staged scene */}
      <div
        className={cn(
          "relative flex h-full flex-col p-6 transition-all duration-500 sm:p-7",
          engaged ? "opacity-100" : "pointer-events-none opacity-0",
          !engaged && "translate-y-3"
        )}
      >
        <span
          className="self-start rounded-full px-3 py-1 font-mono text-[9.5px] font-bold uppercase tracking-[0.18em] text-white"
          style={{ backgroundColor: scene.accent }}
        >
          {scene.eyebrow}
        </span>
        <h3 className="mt-3 font-display text-[1.5rem] font-black leading-tight tracking-[-0.02em] text-ink sm:text-[1.7rem]">
          {scene.title}
        </h3>
        <p className="mt-1 text-[13px] font-medium text-ink/55">{scene.sub}</p>
        <div
          className={cn(
            "mt-auto pt-5",
            scene.wide && "sm:max-w-md sm:self-end sm:pr-2"
          )}
        >
          <Thread scene={scene} playing={engaged} instant={reduce} />
        </div>
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
