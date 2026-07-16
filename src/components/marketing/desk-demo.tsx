"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  GraduationCap,
  HeartPulse,
  Scissors,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { Container, Section } from "./section";
import { Reveal, useReducedMotionSafe } from "./motion-primitives";

/* ------------------------------------------------------------------ *
 * THE SHIFT STAGE — one big card, centre stage, big arrows either
 * side. At rest the card is quiet grey; on hover the trade's theme
 * washes in and the WhatsApp exchange types itself out. Each trade has
 * its own palette and watermark. Touch/reduced-motion visitors get the
 * theme and thread without needing hover.
 * ------------------------------------------------------------------ */

const VERBS = ["answers.", "books.", "chases.", "collects."];

type Msg = { kind: "in" | "out"; text: string };

type Trade = {
  label: string;
  line: string;
  icon: LucideIcon;
  /** Soft wash the card fades to on hover. */
  theme: string;
  /** The trade's accent (chips, watermark, active bar). */
  accent: string;
  thread: Msg[];
  chip: string;
};

const TRADES: Trade[] = [
  {
    label: "Clinics",
    line: "Every ₹40,000 lead answered in seconds.",
    icon: HeartPulse,
    theme: "linear-gradient(150deg, #fdf0f3 0%, #faf6f7 55%, #f5f5f7 100%)",
    accent: "#e11d48",
    thread: [
      { kind: "in", text: "How much is a hair transplant? Saw your ad." },
      { kind: "out", text: "Most cases ₹35–60k depending on grafts. Dr. Mehta has a free consult Thursday 6 PM — hold it for you?" },
      { kind: "in", text: "Yes please" },
      { kind: "out", text: "Done — Thursday 6 PM ✓ I'll remind you the evening before." },
    ],
    chip: "Consult booked · reminder set",
  },
  {
    label: "Restaurants & cafés",
    line: "Full tables. Zero missed chats.",
    icon: UtensilsCrossed,
    theme: "linear-gradient(150deg, #fdf3ea 0%, #fbf7f2 55%, #f5f5f7 100%)",
    accent: "#ea770c",
    thread: [
      { kind: "in", text: "Table for 4 tonight?" },
      { kind: "out", text: "8 PM by the window is free — shall I reserve it?" },
      { kind: "in", text: "Perfect 🎉" },
      { kind: "out", text: "Reserved ✓ See you at 8 — I'll send a reminder at 6." },
    ],
    chip: "Reservation confirmed",
  },
  {
    label: "Salons & spas",
    line: "Chairs stay full. The phone stays down.",
    icon: Scissors,
    theme: "linear-gradient(150deg, #f6f0fb 0%, #f8f5fa 55%, #f5f5f7 100%)",
    accent: "#8b5cf6",
    thread: [
      { kind: "in", text: "Any slot tomorrow evening?" },
      { kind: "out", text: "4:30 PM with Priya is open — book you in?" },
      { kind: "in", text: "Yes 💇‍♀️" },
      { kind: "out", text: "Booked ✓ Reminder coming tomorrow morning." },
    ],
    chip: "Reminder set · 9 AM",
  },
  {
    label: "Real estate",
    line: "Leads chased for weeks, not hours.",
    icon: Building2,
    theme: "linear-gradient(150deg, #ecf4fb 0%, #f2f6fa 55%, #f5f5f7 100%)",
    accent: "#0284c7",
    thread: [
      { kind: "in", text: "Is the 2BHK in Andheri still available?" },
      { kind: "out", text: "Yes — ₹1.4Cr, ready to move. Site visit Sunday 11 AM? I'll send the pin." },
      { kind: "in", text: "Sunday works" },
      { kind: "out", text: "Locked ✓ Pin and parking details coming Saturday evening." },
    ],
    chip: "Site visit scheduled",
  },
  {
    label: "Coaching",
    line: "Answered before parents dial the next institute.",
    icon: GraduationCap,
    theme: "linear-gradient(150deg, #fdf6e7 0%, #fbf8f0 55%, #f5f5f7 100%)",
    accent: "#d97706",
    thread: [
      { kind: "in", text: "What are the fees for the NEET batch?" },
      { kind: "out", text: "₹45,000/year, weekday evenings. Free demo Saturday 11 AM — reserve a seat?" },
      { kind: "in", text: "Yes, for my daughter" },
      { kind: "out", text: "Reserved ✓ Classroom details coming Friday." },
    ],
    chip: "Demo class reserved",
  },
  {
    label: "Gyms & services",
    line: "Quotes in seconds. Deposits upfront.",
    icon: Dumbbell,
    theme: "linear-gradient(150deg, #eaf7f1 0%, #f1f8f4 55%, #f5f5f7 100%)",
    accent: "#0d9488",
    thread: [
      { kind: "in", text: "How much for AC servicing?" },
      { kind: "out", text: "₹599 full service. Technician free tomorrow 10 AM — book with a ₹200 deposit?" },
      { kind: "in", text: "Booking it" },
      { kind: "out", text: "Done ✓ Tomorrow 10 AM — deposit link sent." },
    ],
    chip: "₹200 collected",
  },
];

const STEP_MS = 850;
const TYPING_MS = 950;

/** Vertical word roller for the headline. */
function Roller() {
  const reduce = useReducedMotionSafe();
  const [i, setI] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setI((v) => (v + 1) % VERBS.length), 2200);
    return () => clearInterval(t);
  }, [reduce]);

  if (reduce) return <span className="text-brand-600">answers.</span>;

  // A slot-machine column: every verb is stacked inside the clipped window
  // and the whole column translates — nothing ever animates out of the clip.
  return (
    <span className="relative inline-block h-[1.15em] w-[4.6em] overflow-hidden align-bottom">
      <motion.span
        className="absolute left-0 top-0 flex flex-col"
        animate={{ y: `${-i * 1.15}em` }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        {VERBS.map((v) => (
          <span key={v} className="h-[1.15em] leading-[1.15] text-brand-600">
            {v}
          </span>
        ))}
      </motion.span>
    </span>
  );
}

function Typing({ accent }: { accent: string }) {
  return (
    <div className="flex items-center gap-1 self-end rounded-2xl rounded-br-md bg-[#d9fdd3] px-4 py-3 shadow-[0_1px_2px_rgba(11,20,26,0.06)]">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-bounce rounded-full"
          style={{ animationDelay: `${i * 150}ms`, backgroundColor: `${accent}66` }}
        />
      ))}
    </div>
  );
}

/** The conversation, typed out while `playing`; resets when it stops.
 * The reset happens in the scheduled tick (never synchronously in the
 * effect body) so pausing simply lets the pipeline drain. */
function Thread({ trade, playing }: { trade: Trade; playing: boolean }) {
  const [shown, setShown] = useState(0);
  const [typing, setTyping] = useState(false);
  const done = shown >= trade.thread.length;

  useEffect(() => {
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
      if (!alive || i >= trade.thread.length) return;
      if (trade.thread[i].kind === "out") {
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
    t = setTimeout(() => step(0), 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [playing, trade]);

  return (
    <div className="flex min-h-[13.5rem] flex-col justify-end gap-2 sm:min-h-[14.5rem]">
      {trade.thread.slice(0, shown).map((m, i) => (
        <motion.div
          key={i}
          layout
          initial={{ opacity: 0, y: 10, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            "max-w-[85%] rounded-2xl px-4 py-2.5 text-[13.5px] leading-snug shadow-[0_1px_2px_rgba(11,20,26,0.06)]",
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
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col"
          >
            <Typing accent={trade.accent} />
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {done && (
          <motion.div
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.25 }}
            className="mt-1 flex items-center gap-1.5 self-start pl-1 text-[12px] font-semibold text-ink/60"
          >
            <span
              className="grid h-4.5 w-4.5 place-items-center rounded-full"
              style={{ backgroundColor: trade.accent }}
            >
              <Check className="h-2.5 w-2.5 text-white" aria-hidden />
            </span>
            {trade.chip}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function DeskDemo() {
  const [idx, setIdx] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [coarse, setCoarse] = useState(false); // touch devices: no hover
  const reduce = useReducedMotionSafe();
  const liveRef = useRef<HTMLDivElement>(null);

  // Subscribe to the hover-capability media query (fires once on mount too).
  useEffect(() => {
    const mq = window.matchMedia("(hover: none)");
    const update = () => setCoarse(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const trade = TRADES[idx];
  const Icon = trade.icon;
  // Touch and reduced-motion visitors shouldn't need a cursor.
  const engaged = hovered || coarse || reduce;

  const go = (d: number) =>
    setIdx((v) => (v + d + TRADES.length) % TRADES.length);

  return (
    <Section id="features" className="overflow-hidden border-t border-ink/[0.06] bg-white">
      <span id="industries" className="absolute" aria-hidden />
      <Container>
        <Reveal className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-[clamp(2.4rem,5vw,4.2rem)] font-black leading-[1.04] tracking-[-0.035em] text-ink">
            While you sleep,
            <br />
            it <Roller />
          </h2>
          <p className="mx-auto mt-5 max-w-md text-[16px] leading-relaxed text-ink/50">
            One employee, every kind of front desk — hover the card and watch
            a shift.
          </p>
        </Reveal>

        {/* stage: arrow · card · arrow */}
        <div className="mx-auto mt-12 flex max-w-5xl items-center gap-3 sm:gap-6">
          <button
            type="button"
            aria-label="Previous trade"
            onClick={() => go(-1)}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#f5f5f7] text-ink/60 transition-all duration-200 hover:bg-ink hover:text-white sm:h-14 sm:w-14"
          >
            <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden />
          </button>

          <div
            ref={liveRef}
            className="min-w-0 flex-1"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.article
                key={trade.label}
                initial={reduce ? false : { opacity: 0, x: 36, scale: 0.985 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={reduce ? undefined : { opacity: 0, x: -36, scale: 0.985 }}
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                className="relative overflow-hidden rounded-[32px] p-7 transition-shadow duration-500 sm:p-10"
                style={{
                  background: engaged ? trade.theme : "#f5f5f7",
                  transition: "background 600ms ease",
                  boxShadow: engaged
                    ? "0 30px 60px -36px rgba(10,31,26,0.28)"
                    : "0 0 0 rgba(0,0,0,0)",
                }}
              >
                {/* trade watermark — sets in with the theme */}
                <Icon
                  aria-hidden
                  className="pointer-events-none absolute -bottom-10 -right-10 h-56 w-56 transition-all duration-700"
                  style={{
                    color: trade.accent,
                    opacity: engaged ? 0.08 : 0,
                    transform: engaged ? "rotate(-8deg)" : "rotate(0deg) scale(0.9)",
                  }}
                />

                <div className="relative grid gap-8 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] sm:items-end">
                  <div>
                    <p
                      className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.2em] transition-colors duration-500"
                      style={{ color: engaged ? trade.accent : "rgba(10,31,26,0.4)" }}
                    >
                      {trade.label}
                    </p>
                    <h3 className="serif-display mt-3 max-w-sm text-[1.6rem] leading-[1.18] text-ink sm:text-[2rem]">
                      {trade.line}
                    </h3>
                    <p
                      className={cn(
                        "mt-4 hidden text-[13px] font-medium text-ink/35 transition-opacity duration-300 sm:block",
                        engaged ? "opacity-0" : "opacity-100"
                      )}
                    >
                      Hover to watch the shift →
                    </p>
                  </div>
                  <Thread trade={trade} playing={engaged} />
                </div>
              </motion.article>
            </AnimatePresence>
          </div>

          <button
            type="button"
            aria-label="Next trade"
            onClick={() => go(1)}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#f5f5f7] text-ink/60 transition-all duration-200 hover:bg-ink hover:text-white sm:h-14 sm:w-14"
          >
            <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden />
          </button>
        </div>

        {/* segmented bars + the ask */}
        <div className="mt-8 flex flex-col items-center gap-8">
          <div className="flex items-center gap-1.5" role="tablist" aria-label="Trades">
            {TRADES.map((t, i) => (
              <button
                key={t.label}
                type="button"
                role="tab"
                aria-selected={i === idx}
                aria-label={t.label}
                onClick={() => setIdx(i)}
                className="group py-2"
              >
                <span
                  className="block h-[3px] rounded-full transition-all duration-500"
                  style={{
                    width: i === idx ? 32 : 16,
                    backgroundColor:
                      i === idx ? trade.accent : "rgba(10,31,26,0.15)",
                  }}
                />
              </button>
            ))}
          </div>
          <Link
            href="/waitlist"
            className="group inline-flex items-center gap-2 text-[15px] font-semibold text-ink transition-colors hover:text-brand-700"
          >
            …and yours — hire the Front Desk
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
          </Link>
        </div>
      </Container>
    </Section>
  );
}
