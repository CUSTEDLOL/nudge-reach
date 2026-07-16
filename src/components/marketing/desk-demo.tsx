"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, CheckCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import { Container, Section } from "./section";
import { CountUp, Reveal, useReducedMotionSafe } from "./motion-primitives";

/* ------------------------------------------------------------------ *
 * THE DESK DEMO — a phone pinned beside the copy; picking an industry
 * swaps the business and the conversation types itself out live:
 * inbound → typing dots → reply → confirmation chip. The product is
 * the visual. Replaces the old features bento + industries showcase.
 * ------------------------------------------------------------------ */

type Msg =
  | { kind: "in" | "out"; text: string; time: string }
  | { kind: "status"; text: string };

type Trade = {
  tab: string;
  business: string;
  headline: string;
  sub: string;
  stats: { value: number; prefix?: string; suffix: string; label: string }[];
  thread: Msg[];
};

const TRADES: Trade[] = [
  {
    tab: "Clinics",
    business: "Sunrise Aesthetics",
    headline: "Every ₹40,000 lead answered in seconds.",
    sub: "Hair transplant, derma and dental enquiries chased until the consult books — while you're in surgery.",
    stats: [
      { value: 9, suffix: "s", label: "first reply, any hour" },
      { value: 100, suffix: "%", label: "of ad leads answered" },
      { value: 0, suffix: "", label: "consults lost to silence" },
    ],
    thread: [
      { kind: "in", text: "How much is a hair transplant? Saw your ad.", time: "11:42 PM" },
      { kind: "out", text: "Most cases run ₹35–60k depending on grafts. Dr. Mehta has a free consult Thursday 6 PM — shall I hold it for you?", time: "11:42 PM" },
      { kind: "in", text: "Yes please", time: "11:44 PM" },
      { kind: "out", text: "Done — Thursday 6 PM with Dr. Mehta ✓ I'll remind you the evening before.", time: "11:44 PM" },
      { kind: "status", text: "Consult booked · reminder scheduled" },
    ],
  },
  {
    tab: "Salons",
    business: "Aura Salon & Spa",
    headline: "Chairs stay full without mornings on the phone.",
    sub: "Bookings confirmed, evening-before reminders, rebooking nudges weeks later — automatically.",
    stats: [
      { value: 40, suffix: "%", label: "fewer no-shows" },
      { value: 24, suffix: "/7", label: "bookings taken" },
      { value: 3, suffix: "wk", label: "rebooking nudge" },
    ],
    thread: [
      { kind: "in", text: "Any slot tomorrow evening?", time: "9:18 PM" },
      { kind: "out", text: "4:30 PM with Priya is open — shall I book you in?", time: "9:18 PM" },
      { kind: "in", text: "Perfect 💇‍♀️", time: "9:19 PM" },
      { kind: "out", text: "Booked ✓ See you tomorrow 4:30. I'll send a reminder in the morning.", time: "9:19 PM" },
      { kind: "status", text: "Booked · reminder 9 AM" },
    ],
  },
  {
    tab: "Real estate",
    business: "Skyline Realty",
    headline: "Portal leads chased for weeks, not hours.",
    sub: "Answered in seconds, followed up through the long weeks buyers take to decide — until the site visit lands.",
    stats: [
      { value: 21, suffix: " days", label: "of automatic follow-up" },
      { value: 2, suffix: "×", label: "more site visits" },
      { value: 0, suffix: "", label: "leads gone cold" },
    ],
    thread: [
      { kind: "in", text: "Is the 2BHK in Andheri still available?", time: "10:05 PM" },
      { kind: "out", text: "Yes — ₹1.4Cr, ready to move. Site visit this Sunday 11 AM? I'll send the location pin.", time: "10:05 PM" },
      { kind: "in", text: "Sunday works", time: "10:09 PM" },
      { kind: "out", text: "Locked ✓ Sunday 11 AM — pin and parking details coming Saturday evening.", time: "10:09 PM" },
      { kind: "status", text: "Site visit scheduled" },
    ],
  },
  {
    tab: "Coaching",
    business: "Ascend Academy",
    headline: "Enquiries answered before parents call the next institute.",
    sub: "Admissions season handled: fees, batches, demo classes — and fee reminders always on time.",
    stats: [
      { value: 100, suffix: "%", label: "enquiries answered" },
      { value: 5, suffix: "s", label: "to first reply" },
      { value: 30, suffix: "%", label: "more demos booked" },
    ],
    thread: [
      { kind: "in", text: "What are the fees for the NEET batch?", time: "8:52 PM" },
      { kind: "out", text: "₹45,000/year, weekday evenings. There's a free demo class Saturday 11 AM — shall I reserve a seat?", time: "8:52 PM" },
      { kind: "in", text: "Yes, for my daughter", time: "8:55 PM" },
      { kind: "out", text: "Reserved ✓ Saturday 11 AM — I'll share the classroom details Friday.", time: "8:55 PM" },
      { kind: "status", text: "Demo class reserved" },
    ],
  },
  {
    tab: "Services",
    business: "CoolFix AC Care",
    headline: "Quotes out instantly, deposits in the bank.",
    sub: "Big-brand polish from a two-person team: quote, book, collect, and the “reaching in 20 minutes” update.",
    stats: [
      { value: 100, suffix: "%", label: "quotes sent in seconds" },
      { value: 500, prefix: "₹", suffix: "", label: "deposits collected upfront" },
      { value: 2, suffix: "×", label: "repeat bookings" },
    ],
    thread: [
      { kind: "in", text: "How much for AC servicing?", time: "7:31 PM" },
      { kind: "out", text: "₹599 full service. A technician is free tomorrow 10 AM — book it with a ₹200 deposit?", time: "7:31 PM" },
      { kind: "in", text: "Ok booking it", time: "7:33 PM" },
      { kind: "out", text: "Done ✓ Tomorrow 10 AM. Deposit link: nudge.pay/coolfix — the rest after service.", time: "7:33 PM" },
      { kind: "status", text: "Job booked · ₹200 collected" },
    ],
  },
];

/* Typing rhythm: inbound appears, dots think before every reply. */
const STEP_MS = 950;
const TYPING_MS = 1100;
const CYCLE_PAUSE_MS = 3800;

function Wallpaper() {
  return (
    <div
      aria-hidden
      className="absolute inset-0"
      style={{
        background: "#efe7dd",
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140' viewBox='0 0 140 140'%3E%3Cg fill='none' stroke='%23d5ccc0' stroke-width='1.4'%3E%3Ccircle cx='22' cy='24' r='7'/%3E%3Cpath d='M96 18l3.5 7 7.5 1-5.5 5.5 1.5 7.5-7-3.5-7 3.5 1.5-7.5L85 26l7.5-1z'/%3E%3Cpath d='M30 96c4-6 12-6 16 0s12 6 16 0'/%3E%3Crect x='94' y='92' width='14' height='14' rx='4' transform='rotate(12 101 99)'/%3E%3Ccircle cx='64' cy='58' r='4'/%3E%3Cpath d='M120 58c0-4 8-4 8 0s-8 8-8 8'/%3E%3C/g%3E%3C/svg%3E\")",
        backgroundSize: "140px 140px",
      }}
    />
  );
}

function Bubble({ msg }: { msg: Msg }) {
  if (msg.kind === "status") {
    return (
      <div className="mt-1 flex items-center gap-1.5 self-center rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-semibold text-ink/70 shadow-sm">
        <span className="grid h-4 w-4 place-items-center rounded-full bg-brand-500">
          <Check className="h-2.5 w-2.5 text-white" aria-hidden />
        </span>
        {msg.text}
      </div>
    );
  }
  const out = msg.kind === "out";
  return (
    <div
      className={cn(
        "wa-tail relative max-w-[85%] rounded-lg px-2.5 py-1.5 text-[13px] leading-[1.4] text-[#111b21] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]",
        out
          ? "wa-tail-out self-end rounded-tr-none bg-[#d9fdd3]"
          : "wa-tail-in self-start rounded-tl-none bg-white"
      )}
    >
      {msg.text}
      <span className="float-right ml-2 mt-[7px] flex items-center gap-0.5 text-[9.5px] leading-none text-[#667781]">
        {msg.time}
        {out && <CheckCheck className="h-3 w-3 text-[#53bdeb]" aria-hidden />}
      </span>
    </div>
  );
}

function Typing() {
  return (
    <div className="wa-tail wa-tail-out relative flex items-center gap-1 self-end rounded-lg rounded-tr-none bg-[#d9fdd3] px-3.5 py-2.5 shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#111b21]/35"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  );
}

/** Plays a thread: messages land one by one, dots think before replies.
 * `onDone` fires after the last message has been visible for a beat. */
function PhoneScreen({
  trade,
  reduce,
  paused,
  onDone,
}: {
  trade: Trade;
  reduce: boolean;
  paused: boolean;
  onDone: () => void;
}) {
  // With reduced motion the whole thread is simply visible.
  const [shown, setShown] = useState(0);
  const [typing, setTyping] = useState(false);
  const pausedRef = useRef(paused);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    if (reduce) return;
    let alive = true;
    let t: ReturnType<typeof setTimeout>;

    const step = (i: number) => {
      if (!alive) return;
      if (pausedRef.current) {
        t = setTimeout(() => step(i), 400);
        return;
      }
      if (i >= trade.thread.length) {
        t = setTimeout(() => alive && onDone(), CYCLE_PAUSE_MS);
        return;
      }
      const next = trade.thread[i];
      if (next.kind === "out") {
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

    // The 500ms lead-in also resets the thread for the incoming trade.
    t = setTimeout(() => {
      if (!alive) return;
      setShown(0);
      setTyping(false);
      step(0);
    }, 500);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trade, reduce]);

  const visible = reduce ? trade.thread.length : shown;

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      {/* header */}
      <div className="relative z-10 flex items-center gap-2.5 bg-[#f7f8fa] px-3.5 py-3 shadow-[0_1px_2px_rgba(11,20,26,0.08)]">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-500 text-[12px] font-black text-white">
          {trade.business[0]}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold leading-tight text-[#111b21]">
            {trade.business}
          </p>
          <p className="text-[10.5px] leading-tight text-[#667781]">online</p>
        </div>
      </div>
      {/* thread */}
      <div className="relative flex-1">
        <Wallpaper />
        <div className="relative flex h-full flex-col justify-end gap-1.5 p-3 pb-4">
          {trade.thread.slice(0, visible).map((m, i) => (
            <motion.div
              key={i}
              layout
              initial={reduce ? false : { opacity: 0, y: 10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col"
            >
              <Bubble msg={m} />
            </motion.div>
          ))}
          <AnimatePresence>
            {typing && (
              <motion.div
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col"
              >
                <Typing />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export function DeskDemo() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduce = useReducedMotionSafe();
  const trade = TRADES[active];

  return (
    <Section id="features" className="border-t border-ink/10 bg-white">
      <span id="industries" className="absolute" aria-hidden />
      <Container>
        <Reveal className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-[2.2rem] font-black uppercase leading-[1.02] tracking-[-0.02em] text-ink sm:text-[3rem]">
            One employee.
            <span className="serif-display mt-2 block text-[1.7rem] normal-case tracking-normal text-ink/85 sm:text-[2.3rem]">
              Every kind of front desk.
            </span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[16px] leading-relaxed text-ink/55">
            Pick your trade — and watch a real shift, live.
          </p>
        </Reveal>

        {/* tabs */}
        <Reveal className="mt-10">
          <div
            className="mx-auto flex max-w-3xl gap-1.5 overflow-x-auto rounded-full border border-ink/10 bg-[#f6f7f6] p-1.5 sm:justify-center"
            role="tablist"
            aria-label="Pick an industry"
          >
            {TRADES.map((t, i) => {
              const on = i === active;
              return (
                <button
                  key={t.tab}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setActive(i)}
                  className={cn(
                    "relative shrink-0 rounded-full px-4 py-2 text-[13.5px] font-semibold transition-colors duration-200",
                    on ? "text-white" : "text-ink/55 hover:text-ink"
                  )}
                >
                  {on && (
                    <motion.span
                      layoutId="desk-demo-tab"
                      className="absolute inset-0 rounded-full bg-ink"
                      transition={{ type: "spring", stiffness: 380, damping: 34 }}
                    />
                  )}
                  <span className="relative">{t.tab}</span>
                </button>
              );
            })}
          </div>
        </Reveal>

        {/* stage */}
        <div
          className="mx-auto mt-12 grid max-w-5xl items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {/* copy + stats */}
          <div className="order-2 lg:order-1">
            <AnimatePresence mode="wait">
              <motion.div
                key={trade.tab}
                initial={reduce ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: -10 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              >
                <h3 className="serif-display max-w-lg text-[1.75rem] leading-[1.15] text-ink sm:text-[2.2rem]">
                  {trade.headline}
                </h3>
                <p className="mt-4 max-w-md text-[15.5px] leading-relaxed text-ink/60">
                  {trade.sub}
                </p>
                <dl className="mt-9 grid grid-cols-3 gap-6 border-t border-ink/10 pt-7">
                  {trade.stats.map((s) => (
                    <div key={s.label}>
                      <dd className="font-display text-[1.9rem] font-black tracking-[-0.03em] text-ink sm:text-[2.3rem]">
                        <CountUp to={s.value} prefix={s.prefix} suffix={s.suffix} />
                      </dd>
                      <dt className="mt-1.5 text-[12px] font-medium leading-snug text-ink/50">
                        {s.label}
                      </dt>
                    </div>
                  ))}
                </dl>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* the phone */}
          <div className="order-1 flex justify-center lg:order-2">
            <div className="w-[min(20rem,88vw)] rounded-[2.4rem] bg-[#0b0f0d] p-[9px] shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset,0_34px_80px_-32px_rgba(10,15,13,0.5)]">
              <div className="h-[30rem] overflow-hidden rounded-[2rem] sm:h-[32rem]">
                <PhoneScreen
                  trade={trade}
                  reduce={reduce}
                  paused={paused}
                  onDone={() => setActive((a) => (a + 1) % TRADES.length)}
                />
              </div>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
