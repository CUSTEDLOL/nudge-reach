"use client";

import { useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Building2,
  Check,
  GraduationCap,
  HeartPulse,
  UtensilsCrossed,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Container, Section } from "./section";
import { Reveal, useReducedMotionSafe } from "./motion-primitives";

type Industry = {
  icon: LucideIcon;
  title: string;
  outcome: string;
  body: string;
  /** Vivid category accent (6-digit hex) — markers, ring, icon, check chip. */
  color: string;
  /** Soft pastel of the same hue — the visual panel's surface. */
  soft: string;
  chat: { inbound: string; reply: string; status: string };
};

const INDUSTRIES: Industry[] = [
  {
    icon: HeartPulse,
    title: "Clinics, salons & spas",
    outcome: "fewer no-shows, fuller chairs",
    body: "Appointments confirmed automatically, reminders the evening before, a rebooking nudge weeks later.",
    color: "#f43f5e",
    soft: "#fdecef",
    chat: {
      inbound: "Any slot tomorrow evening?",
      reply: "4:30 PM with Priya is open — booked you in ✓",
      status: "Reminder scheduled · 9 AM",
    },
  },
  {
    icon: GraduationCap,
    title: "Education & coaching",
    outcome: "fuller batches",
    body: "Admission enquiries answered before parents call the next institute. Fee reminders and demo follow-ups, on time.",
    color: "#8b5cf6",
    soft: "#f0ecfb",
    chat: {
      inbound: "What are the fees for the NEET batch?",
      reply: "₹45,000/year — free demo class Sat 11 AM. Reserve a seat?",
      status: "Demo class booked",
    },
  },
  {
    icon: UtensilsCrossed,
    title: "Restaurants & cafés",
    outcome: "fuller tables",
    body: "Reservations, pre-orders and feedback follow-ups handled while the kitchen runs at full tilt.",
    color: "#f97316",
    soft: "#fdeee1",
    chat: {
      inbound: "Table for 4 tonight?",
      reply: "8 PM by the window — reserved for you 🎉",
      status: "Reservation confirmed",
    },
  },
  {
    icon: Building2,
    title: "Real estate",
    outcome: "warmer leads",
    body: "Portal enquiries answered in seconds, site-visit details on time, follow-ups through weeks of deciding.",
    color: "#0ea5e9",
    soft: "#e6f3fb",
    chat: {
      inbound: "Is the 2BHK in Andheri still available?",
      reply: "Yes — site visit this Sunday 11 AM? I'll send the location.",
      status: "Site visit scheduled",
    },
  },
  {
    icon: Wrench,
    title: "Local services",
    outcome: "repeat bookings",
    body: "Quotes, confirmations and “reaching in 20 minutes” updates — big-brand polish from a two-person team.",
    color: "#14b8a6",
    soft: "#e3f6f2",
    chat: {
      inbound: "How much for AC servicing?",
      reply: "₹599 — technician free tomorrow 10 AM. Book it?",
      status: "Job scheduled",
    },
  },
];

const SWAP = 5200; // ms the loader ring takes to fill before auto-advancing
const RING_R = 46;
const RING_CIRC = 2 * Math.PI * RING_R; // ≈ 289

/** The workspace panel for the active trade: a soft pastel canvas where the
 * Front Desk "works" — the incoming question floats in top-left, a loader
 * ring in the trade's vivid accent turns in the centre (and doubles as the
 * auto-advance timer: when it finishes it calls `onDone`), and the resolved
 * outcome lands bottom-right. */
function IndustryVisual({
  item,
  paused,
  reduce,
  onDone,
}: {
  item: Industry;
  paused: boolean;
  reduce: boolean;
  onDone: () => void;
}) {
  const { icon: Icon, title, outcome, color, soft, chat } = item;
  return (
    <div
      className="relative flex min-h-[480px] flex-col overflow-hidden rounded-3xl border border-black/[0.05] p-7 shadow-[0_26px_50px_-32px_rgba(10,31,26,0.25)] sm:min-h-[520px] sm:p-9"
      style={{ backgroundColor: soft }}
    >
      {/* concentric ring texture, centred on the loader */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.14]">
        {[0, 1, 2, 3, 4].map((r) => (
          <span
            key={r}
            className="absolute left-1/2 top-[56%] -translate-x-1/2 -translate-y-1/2 rounded-full border"
            style={{ width: 150 + r * 130, height: 150 + r * 130, borderColor: color }}
          />
        ))}
      </div>

      {/* header */}
      <div className="relative flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.04]">
          <Icon className="h-6 w-6" style={{ color }} aria-hidden />
        </span>
        <div>
          <h3 className="text-[1.15rem] font-bold leading-tight text-ink">
            {title}
          </h3>
          <p className="serif-display text-[15px] text-ink/60">{outcome}</p>
        </div>
      </div>

      {/* work stage */}
      <div className="relative mt-6 flex flex-1 items-center justify-center">
        {/* incoming question — floats top-left */}
        <div
          className="absolute left-0 top-1 max-w-[68%] rounded-2xl rounded-bl-md bg-white px-4 py-3 text-[13.5px] font-medium leading-snug text-ink shadow-[0_14px_30px_-18px_rgba(10,31,26,0.3)] ring-1 ring-black/[0.04]"
          style={reduce ? undefined : { animation: "scene-float 7s ease-in-out infinite" }}
        >
          {chat.inbound}
        </div>

        {/* the loader ring — Front Desk working; its fill IS the dwell timer */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative grid place-items-center">
            <svg viewBox="0 0 120 120" className="h-[132px] w-[132px]">
              <circle
                cx="60"
                cy="60"
                r={RING_R}
                fill="none"
                stroke={color}
                strokeOpacity="0.2"
                strokeWidth="4"
              />
              <circle
                cx="60"
                cy="60"
                r={RING_R}
                fill="none"
                stroke={color}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={RING_CIRC}
                transform="rotate(-90 60 60)"
                onAnimationEnd={onDone}
                style={
                  reduce
                    ? { strokeDashoffset: 0 }
                    : ({
                        strokeDashoffset: RING_CIRC,
                        animation: `ind-ring ${SWAP}ms linear forwards`,
                        animationPlayState: paused ? "paused" : "running",
                        "--circ": RING_CIRC,
                      } as CSSProperties)
                }
              />
            </svg>
            <span className="absolute grid h-[52px] w-[52px] place-items-center rounded-full bg-white shadow-sm ring-1 ring-black/[0.04]">
              <Icon className="h-6 w-6" style={{ color }} aria-hidden />
            </span>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold text-ink/70 ring-1 ring-black/[0.04]">
            Front Desk working
            <span className="flex gap-0.5" aria-hidden>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1 w-1 rounded-full motion-safe:animate-pulse"
                  style={{ animationDelay: `${i * 180}ms`, backgroundColor: color }}
                />
              ))}
            </span>
          </span>
        </div>

        {/* resolved outcome — floats bottom-right */}
        <div
          className="absolute bottom-1 right-0 max-w-[74%] rounded-2xl bg-white px-4 py-3 shadow-[0_14px_30px_-18px_rgba(10,31,26,0.3)] ring-1 ring-black/[0.04]"
          style={reduce ? undefined : { animation: "scene-float 8.5s ease-in-out infinite" }}
        >
          <div className="flex items-center gap-2">
            <span
              className="grid h-6 w-6 shrink-0 place-items-center rounded-full"
              style={{ backgroundColor: color }}
            >
              <Check className="h-3.5 w-3.5 text-white" aria-hidden />
            </span>
            <span className="text-[12.5px] font-bold text-ink">{chat.status}</span>
          </div>
          <p className="mt-1.5 line-clamp-2 text-[12px] leading-snug text-ink/60">
            {chat.reply}
          </p>
        </div>
      </div>
    </div>
  );
}

export function Industries() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduce = useReducedMotionSafe();
  const item = INDUSTRIES[active];

  // The loader ring is the timer: when it finishes filling it calls this to
  // advance. Hover/focus pauses the ring (below); reduced-motion never fills
  // it, so those visitors just click through.
  const advance = () => setActive((a) => (a + 1) % INDUSTRIES.length);

  return (
    <Section id="industries" className="bg-white">
      <Container>
        <Reveal className="max-w-3xl">
          <span className="inline-flex items-center rounded-full border border-ink/15 px-4 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-ink/55">
            Industries
          </span>
          <h2 className="mt-6 font-display text-[2.2rem] font-black uppercase leading-[1.02] tracking-[-0.02em] text-ink sm:text-[3rem]">
            If the phone rings all day,
            <span className="serif-display mt-2 block text-[1.8rem] normal-case tracking-normal text-ink/85 sm:text-[2.4rem]">
              Nudge fits.
            </span>
          </h2>
          <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-ink/55">
            From a two-chair salon in Indore to a factory floor in Ludhiana — if
            your customers message you, it fits the way you already work. Pick a
            trade and watch the Front Desk work it.
          </p>
        </Reveal>

        <div
          className="mt-14 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)] lg:gap-16"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={() => setPaused(false)}
        >
          {/* left: the colourful visual, sticky beside the list */}
          <div className="lg:sticky lg:top-28">
            <AnimatePresence mode="wait">
              <motion.div
                key={item.title}
                initial={reduce ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: -10 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                <IndustryVisual
                  item={item}
                  paused={paused}
                  reduce={reduce}
                  onDone={advance}
                />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* right: the clickable industry list */}
          <ul className="flex flex-col">
            {INDUSTRIES.map((ind, i) => {
              const on = i === active;
              return (
                <li key={ind.title} className="border-b border-ink/[0.08]">
                  <button
                    type="button"
                    onClick={() => setActive(i)}
                    aria-current={on}
                    className="group flex w-full items-center gap-3.5 py-4 text-left"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "h-2.5 w-2.5 shrink-0 rounded-full transition-all duration-300",
                        !on && "bg-ink/15 group-hover:bg-ink/30"
                      )}
                      style={on ? { backgroundColor: ind.color } : undefined}
                    />
                    <span
                      className={cn(
                        "serif-display text-[1.4rem] transition-all duration-300 sm:text-[1.6rem]",
                        on
                          ? "text-ink"
                          : "text-ink/30 group-hover:translate-x-0.5 group-hover:text-ink/60"
                      )}
                    >
                      {ind.title}
                    </span>
                  </button>

                  <AnimatePresence initial={false}>
                    {on && (
                      <motion.div
                        initial={reduce ? false : { height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={reduce ? undefined : { height: 0, opacity: 0 }}
                        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden"
                      >
                        <p className="max-w-md pb-5 pl-6 text-[14px] leading-relaxed text-ink/60">
                          {ind.body}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              );
            })}
          </ul>
        </div>
      </Container>
    </Section>
  );
}
