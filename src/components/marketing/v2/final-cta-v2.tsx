"use client";

import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, CalendarCheck2, IndianRupee, MessageCircle } from "lucide-react";
import { BookDemoButton } from "@/components/marketing/book-demo";

/**
 * The closer: a full-viewport, deep ink-green stage with slow aurora glows
 * and three glassy chat cards floating at the edges — the product quietly
 * doing its job while the owner reads one simple line and books a demo.
 * All motion is decorative and disabled under prefers-reduced-motion.
 */

const AURORAS: {
  className: string;
  drift: { x: number[]; y: number[]; scale: number[] };
  duration: number;
}[] = [
  {
    className: "left-[-12%] top-[-18%] h-[34rem] w-[34rem] bg-brand-500/30",
    drift: { x: [0, 90, 0], y: [0, 50, 0], scale: [1, 1.15, 1] },
    duration: 26,
  },
  {
    className: "right-[-10%] top-[22%] h-[30rem] w-[30rem] bg-emerald-400/20",
    drift: { x: [0, -70, 0], y: [0, 60, 0], scale: [1.1, 0.95, 1.1] },
    duration: 32,
  },
  {
    className: "bottom-[-22%] left-[28%] h-[36rem] w-[36rem] bg-lime-300/15",
    drift: { x: [0, 60, 0], y: [0, -40, 0], scale: [1, 1.12, 1] },
    duration: 29,
  },
];

const CARDS = [
  {
    icon: CalendarCheck2,
    title: "Booked",
    line: "Table for 4, Saturday 7 PM",
    className: "left-[6%] top-[20%] hidden lg:block",
    delay: 0,
  },
  {
    icon: IndianRupee,
    title: "Payment received",
    line: "₹500 deposit collected",
    className: "right-[6%] top-[30%] hidden lg:block",
    delay: 1.6,
  },
  {
    icon: MessageCircle,
    title: "Following up",
    line: "Priya went quiet, nudging her now",
    className: "bottom-[16%] left-[10%] hidden xl:block",
    delay: 0.8,
  },
] as const;

function FloatingCard({
  card,
  still,
}: {
  card: (typeof CARDS)[number];
  still: boolean;
}) {
  const Icon = card.icon;
  return (
    <motion.div
      aria-hidden
      className={`pointer-events-none absolute ${card.className}`}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay: 0.3 + card.delay * 0.2 }}
    >
      <motion.div
        animate={still ? undefined : { y: [0, -14, 0], rotate: [0, 1.2, 0] }}
        transition={{
          duration: 7,
          repeat: Infinity,
          ease: "easeInOut",
          delay: card.delay,
        }}
        className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/[0.07] px-4 py-3 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.6)] backdrop-blur-md"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-500/25 text-brand-200">
          <Icon className="h-4.5 w-4.5" />
        </span>
        <span>
          <span className="block text-[12px] font-bold uppercase tracking-[0.08em] text-brand-200">
            {card.title}
          </span>
          <span className="block text-[13.5px] font-medium text-white/85">
            {card.line}
          </span>
        </span>
      </motion.div>
    </motion.div>
  );
}

export function FinalCtaV2() {
  const still = useReducedMotion() ?? false;

  return (
    <section
      aria-label="Book a demo"
      className="relative isolate flex min-h-[100svh] items-center justify-center overflow-hidden bg-[#06120c]"
    >
      {/* slow aurora glows */}
      {AURORAS.map((a, i) => (
        <motion.div
          key={i}
          aria-hidden
          className={`absolute rounded-full blur-[110px] ${a.className}`}
          animate={still ? undefined : a.drift}
          transition={{ duration: a.duration, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}

      {/* faint dot grid so the dark field has texture */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "34px 34px",
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 45%, black, transparent)",
          WebkitMaskImage:
            "radial-gradient(ellipse 70% 60% at 50% 45%, black, transparent)",
        }}
      />

      {/* the product, quietly working in the margins */}
      {CARDS.map((card) => (
        <FloatingCard key={card.title} card={card} still={still} />
      ))}

      <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center px-5 py-28 text-center sm:px-6">
        <motion.span
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-1.5 text-[12px] font-semibold uppercase tracking-[0.16em] text-white/70 backdrop-blur-sm"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-brand-400" aria-hidden />
          The AI front desk for WhatsApp
        </motion.span>

        <motion.h2
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.65, delay: 0.08 }}
          className="serif-display mt-7 text-[clamp(2.6rem,6.5vw,5.5rem)] leading-[1.04] tracking-[-0.02em] text-white"
        >
          Your WhatsApp,{" "}
          <span className="bg-gradient-to-r from-brand-300 via-brand-400 to-lime-300 bg-clip-text text-transparent">
            handled.
          </span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.16 }}
          className="mt-5 max-w-xl text-[17px] leading-relaxed text-white/70"
        >
          It answers, books and follows up. You run the business.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.24 }}
          className="relative mt-9"
        >
          {/* soft pulse behind the ask */}
          {!still && (
            <motion.span
              aria-hidden
              className="absolute inset-0 -z-10 rounded-2xl bg-brand-400/40 blur-xl"
              animate={{ opacity: [0.35, 0.7, 0.35], scale: [0.96, 1.06, 0.96] }}
              transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
          <BookDemoButton className="group/link inline-flex items-center gap-2 rounded-2xl bg-white px-8 py-4 text-[16.5px] font-semibold text-ink shadow-[0_20px_60px_-16px_rgba(6,193,103,0.55)] transition-all hover:-translate-y-0.5 hover:bg-brand-50">
            Book a Demo
            <ArrowRight
              className="h-4 w-4 transition-transform duration-300 group-hover/link:translate-x-0.5"
              aria-hidden
            />
          </BookDemoButton>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-6 text-[13px] text-white/45"
        >
          15 minutes. See it answer, book and follow up live.
        </motion.p>
      </div>
    </section>
  );
}
