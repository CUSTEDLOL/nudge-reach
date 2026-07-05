"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CalendarCheck, Check, Sparkles } from "lucide-react";

/**
 * The product IS the hero: a live-feeling WhatsApp thread where the AI Front
 * Desk books a real appointment, then chases a quiet lead back. Scripted, not
 * a real API — but it shows exactly what the agent does. Reduced-motion users
 * get the whole thread rendered statically (no hidden content — the SSR
 * opacity-0 bug class is avoided by never gating content on client-only state
 * for those users).
 */

type Line =
  | { kind: "in" | "out"; text: string }
  | { kind: "event"; text: string; icon: "calendar" | "spark" };

const SCRIPT: Line[] = [
  { kind: "in", text: "Hi! Do you have any slots this Saturday? 💇" },
  { kind: "out", text: "Hi Priya! Saturday I have 11am or 2pm open — which suits you?" },
  { kind: "in", text: "2pm please 🙌" },
  {
    kind: "out",
    text: "Done — booked you for Sat 2pm. Added it to the calendar, you'll get a reminder. See you then! ✨",
  },
  { kind: "event", icon: "calendar", text: "Event created in Google Calendar" },
  { kind: "event", icon: "spark", text: "Lead went quiet 3 days ago — chasing…" },
  {
    kind: "out",
    text: "Hi Rahul, still keen on the consultation? Happy to hold a slot for you this week 😊",
  },
  { kind: "in", text: "Oh yes — Tuesday?" },
  { kind: "out", text: "Tuesday 4pm it is ✅ Confirmed and reminder set." },
  { kind: "event", icon: "spark", text: "Quiet lead recovered · booking confirmed" },
];

const emptySubscribe = () => () => {};
function useHydrated() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

export function AgentConversation() {
  const reduce = useReducedMotion();
  const hydrated = useHydrated();
  // Static full thread on the server, first client render, and for reduced motion.
  const animate = hydrated && !reduce;

  const [count, setCount] = useState(SCRIPT.length);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    if (!animate) return;
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;

    const step = () => {
      if (i >= SCRIPT.length) {
        timer = setTimeout(() => {
          i = 0;
          setCount(0);
          step();
        }, 3800);
        return;
      }
      const line = SCRIPT[i];
      const reveal = () => {
        setTyping(false);
        setCount(i + 1);
        i += 1;
        timer = setTimeout(step, line.kind === "event" ? 900 : 1250);
      };
      if (line.kind === "out") {
        setTyping(true);
        timer = setTimeout(reveal, 1100);
      } else {
        reveal();
      }
    };
    // Reset + start on the next tick so no setState runs synchronously in the
    // effect body (avoids cascading renders).
    timer = setTimeout(() => {
      setCount(0);
      step();
    }, 120);
    return () => clearTimeout(timer);
  }, [animate]);

  const shown = SCRIPT.slice(0, count);

  return (
    <div className="mx-auto w-full max-w-[360px]">
      <div className="overflow-hidden rounded-[2rem] border border-black/10 bg-[#0b141a] shadow-2xl shadow-brand-900/20 ring-1 ring-white/10">
        {/* header */}
        <div className="flex items-center gap-3 bg-[#1f2c34] px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-sm font-semibold text-white">
            N
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              Glow Skin &amp; Hair
            </p>
            <p className="flex items-center gap-1 text-[11px] text-brand-300">
              <Sparkles className="h-3 w-3" aria-hidden /> AI Front Desk · online
            </p>
          </div>
        </div>

        {/* thread */}
        <div
          className="flex min-h-[420px] flex-col gap-2 bg-[#0b141a] bg-[radial-gradient(rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:16px_16px] px-3 py-4"
          aria-label="Example WhatsApp conversation with the AI Front Desk"
        >
          <AnimatePresence initial={false}>
            {shown.map((line, idx) => (
              <Bubble key={idx} line={line} animate={animate} />
            ))}
          </AnimatePresence>
          {animate && typing && <Typing />}
        </div>
      </div>
    </div>
  );
}

function Bubble({ line, animate }: { line: Line; animate: boolean }) {
  const common = animate
    ? {
        initial: { opacity: 0, y: 10, scale: 0.98 },
        animate: { opacity: 1, y: 0, scale: 1 },
        transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
      }
    : {};

  if (line.kind === "event") {
    return (
      <motion.div {...common} className="my-1 flex justify-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/15 px-3 py-1 text-[11px] font-medium text-brand-200 ring-1 ring-brand-400/20">
          {line.icon === "calendar" ? (
            <CalendarCheck className="h-3 w-3" aria-hidden />
          ) : (
            <Sparkles className="h-3 w-3" aria-hidden />
          )}
          {line.text}
        </span>
      </motion.div>
    );
  }

  const out = line.kind === "out";
  return (
    <motion.div
      {...common}
      className={`flex ${out ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`relative max-w-[80%] rounded-2xl px-3 py-2 text-[13px] leading-snug ${
          out
            ? "rounded-br-sm bg-[#005c4b] text-white"
            : "rounded-bl-sm bg-[#1f2c34] text-neutral-100"
        }`}
      >
        {line.text}
        {out && (
          <span className="ml-1 inline-flex translate-y-[2px] text-brand-300">
            <Check className="h-3 w-3" aria-hidden />
            <Check className="-ml-1.5 h-3 w-3" aria-hidden />
          </span>
        )}
      </div>
    </motion.div>
  );
}

function Typing() {
  return (
    <div className="flex justify-end">
      <div className="flex items-center gap-1 rounded-2xl rounded-br-sm bg-[#005c4b] px-3 py-2.5">
        {[0, 1, 2].map((i) => (
          <TypingDot key={i} i={i} />
        ))}
      </div>
    </div>
  );
}

function TypingDot({ i }: { i: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  return (
    <motion.span
      ref={ref}
      className="block h-1.5 w-1.5 rounded-full bg-brand-200"
      animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
      transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
    />
  );
}
