"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { Container, Section } from "./section";
import { Reveal, useReducedMotionSafe } from "./motion-primitives";

/* ------------------------------------------------------------------ *
 * THE SHIFT RAIL — Apple-gallery treatment: a rolling verb in the
 * headline, then a horizontal snap rail of quiet grey cards (one per
 * trade, one WhatsApp moment each), segmented autoplay bars, chevrons.
 * Minimal: #f5f5f7 cards, ink type, one green accent.
 * ------------------------------------------------------------------ */

const VERBS = ["answers.", "books.", "chases.", "collects."];

type Card = {
  label: string;
  line: string;
  chat: { inbound: string; reply: string; chip: string };
};

const CARDS: Card[] = [
  {
    label: "Clinics",
    line: "Every ₹40,000 lead answered in seconds.",
    chat: {
      inbound: "How much is a hair transplant?",
      reply: "Most cases ₹35–60k. Dr. Mehta has a free consult Thursday 6 PM — hold it?",
      chip: "Consult booked",
    },
  },
  {
    label: "Salons & spas",
    line: "Chairs stay full. The phone stays down.",
    chat: {
      inbound: "Any slot tomorrow evening?",
      reply: "4:30 PM with Priya is open — booked you in ✓",
      chip: "Reminder set · 9 AM",
    },
  },
  {
    label: "Real estate",
    line: "Leads chased for weeks, not hours.",
    chat: {
      inbound: "Is the 2BHK in Andheri still available?",
      reply: "Yes — site visit Sunday 11 AM? I'll send the pin.",
      chip: "Site visit scheduled",
    },
  },
  {
    label: "Coaching",
    line: "Answered before parents dial the next institute.",
    chat: {
      inbound: "Fees for the NEET batch?",
      reply: "₹45,000/year — free demo Saturday 11 AM. Reserve a seat?",
      chip: "Demo reserved",
    },
  },
  {
    label: "Local services",
    line: "Quotes in seconds. Deposits upfront.",
    chat: {
      inbound: "How much for AC servicing?",
      reply: "₹599 — technician free tomorrow 10 AM. Book it?",
      chip: "₹200 collected",
    },
  },
];

const ADVANCE_MS = 3600;

/** Vertical word roller — one verb visible, the next rolls up into place. */
function Roller() {
  const reduce = useReducedMotionSafe();
  const [i, setI] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setI((v) => (v + 1) % VERBS.length), 2200);
    return () => clearInterval(t);
  }, [reduce]);

  if (reduce) return <span className="text-brand-600">answers.</span>;

  return (
    <span className="relative inline-block h-[1.18em] w-[4.6em] overflow-hidden align-bottom [clip-path:inset(0)]">
      <AnimatePresence initial={false}>
        <motion.span
          key={VERBS[i]}
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "-100%" }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="absolute left-0 top-0 text-brand-600"
        >
          {VERBS[i]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function TradeCard({ card }: { card: Card }) {
  return (
    <article className="flex h-[24rem] w-[19rem] shrink-0 snap-center flex-col rounded-[28px] bg-[#f5f5f7] p-7 sm:h-[26rem] sm:w-[21rem] sm:snap-start">
      <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.2em] text-ink/40">
        {card.label}
      </p>
      <h3 className="serif-display mt-3 text-[1.45rem] leading-[1.2] text-ink sm:text-[1.6rem]">
        {card.line}
      </h3>

      {/* one WhatsApp moment */}
      <div className="mt-auto flex flex-col gap-2">
        <div className="max-w-[92%] self-start rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-[12.5px] leading-snug text-ink/85 shadow-[0_1px_2px_rgba(11,20,26,0.06)]">
          {card.chat.inbound}
        </div>
        <div className="max-w-[92%] self-end rounded-2xl rounded-br-md bg-[#d9fdd3] px-3.5 py-2.5 text-[12.5px] leading-snug text-[#111b21] shadow-[0_1px_2px_rgba(11,20,26,0.06)]">
          {card.chat.reply}
        </div>
        <div className="mt-1 flex items-center gap-1.5 self-start pl-1 text-[11.5px] font-semibold text-ink/55">
          <span className="grid h-4 w-4 place-items-center rounded-full bg-brand-500">
            <Check className="h-2.5 w-2.5 text-white" aria-hidden />
          </span>
          {card.chat.chip}
        </div>
      </div>
    </article>
  );
}

export function DeskDemo() {
  const railRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [held, setHeld] = useState(false); // user took the wheel
  const reduce = useReducedMotionSafe();

  const cardStep = () => {
    const rail = railRef.current;
    if (!rail) return 360;
    const card = rail.querySelector("article");
    return (card?.getBoundingClientRect().width ?? 336) + 20;
  };

  const goTo = (i: number, smooth = true) => {
    const rail = railRef.current;
    if (!rail) return;
    const clamped = Math.max(0, Math.min(CARDS.length - 1, i));
    rail.scrollTo({
      left: clamped * cardStep(),
      behavior: smooth && !reduce ? "smooth" : "auto",
    });
  };

  // Track the active card from real scroll position (drag, wheel, buttons).
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const onScroll = () => {
      setActive(Math.max(0, Math.min(CARDS.length - 1, Math.round(rail.scrollLeft / cardStep()))));
    };
    rail.addEventListener("scroll", onScroll, { passive: true });
    return () => rail.removeEventListener("scroll", onScroll);
  }, []);

  // Gentle autoplay until the visitor interacts with the rail.
  useEffect(() => {
    if (reduce || held) return;
    const t = setInterval(() => {
      const rail = railRef.current;
      if (!rail) return;
      const next = (Math.round(rail.scrollLeft / cardStep()) + 1) % CARDS.length;
      goTo(next);
    }, ADVANCE_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce, held]);

  return (
    <Section id="features" className="overflow-hidden border-t border-ink/[0.06] bg-white">
      <span id="industries" className="absolute" aria-hidden />
      <Container>
        <Reveal className="max-w-3xl">
          <h2 className="font-display text-[clamp(2.4rem,5vw,4.2rem)] font-black leading-[1.04] tracking-[-0.035em] text-ink">
            While you sleep,
            <br />
            it <Roller />
          </h2>
          <p className="mt-6 max-w-md text-[16.5px] leading-relaxed text-ink/50">
            One employee, every kind of front desk — a real moment from each.
          </p>
        </Reveal>
      </Container>

      {/* the rail — bleeds off the right edge like a product gallery */}
      <div
        className="mt-12"
        onPointerDown={() => setHeld(true)}
        onWheel={() => setHeld(true)}
      >
        <div
          ref={railRef}
          className="flex snap-x snap-mandatory gap-5 overflow-x-auto px-5 pb-4 [-ms-overflow-style:none] [scrollbar-width:none] sm:px-[max(1.25rem,calc((100vw-80rem)/2+2rem))] [&::-webkit-scrollbar]:hidden"
        >
          {CARDS.map((c) => (
            <TradeCard key={c.label} card={c} />
          ))}
          {/* the closing card */}
          <article className="flex h-[24rem] w-[19rem] shrink-0 snap-center flex-col justify-between rounded-[28px] bg-ink p-7 sm:h-[26rem] sm:w-[21rem] sm:snap-start">
            <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.2em] text-white/40">
              Your business
            </p>
            <div>
              <h3 className="serif-display text-[1.9rem] leading-[1.15] text-white">
                …and yours.
              </h3>
              <p className="mt-3 text-[14px] leading-relaxed text-white/60">
                If customers message you, it fits the way you already work.
              </p>
              <Link
                href="/waitlist"
                className="group mt-6 inline-flex items-center gap-2 text-[14.5px] font-semibold text-brand-400 transition-colors hover:text-brand-300"
              >
                Hire the Front Desk
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
              </Link>
            </div>
          </article>
          {/* breathing room at the end of the scroll */}
          <div className="w-1 shrink-0" aria-hidden />
        </div>
      </div>

      {/* controls: segmented bars + chevrons */}
      <Container>
        <div className="mt-6 flex items-center justify-between">
          <div className="flex items-center gap-1.5" role="tablist" aria-label="Cards">
            {CARDS.map((c, i) => (
              <button
                key={c.label}
                type="button"
                role="tab"
                aria-selected={i === active}
                aria-label={c.label}
                onClick={() => {
                  setHeld(true);
                  goTo(i);
                }}
                className="group py-2"
              >
                <span
                  className={cn(
                    "block h-[3px] rounded-full transition-all duration-500",
                    i === active
                      ? "w-8 bg-ink"
                      : "w-4 bg-ink/15 group-hover:bg-ink/30"
                  )}
                />
              </button>
            ))}
          </div>
          <div className="hidden gap-2.5 sm:flex">
            <button
              type="button"
              aria-label="Previous"
              onClick={() => {
                setHeld(true);
                goTo(active - 1);
              }}
              className="grid h-10 w-10 place-items-center rounded-full bg-[#f5f5f7] text-ink/70 transition-colors hover:bg-ink/10 hover:text-ink"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              aria-label="Next"
              onClick={() => {
                setHeld(true);
                goTo(active + 1);
              }}
              className="grid h-10 w-10 place-items-center rounded-full bg-[#f5f5f7] text-ink/70 transition-colors hover:bg-ink/10 hover:text-ink"
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>
      </Container>
    </Section>
  );
}
