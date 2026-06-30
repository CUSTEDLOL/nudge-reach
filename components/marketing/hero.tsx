"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  Star,
  Zap,
} from "lucide-react";
import { ButtonLink } from "./button";
import { WhatsAppCard } from "./whatsapp-card";
import { CountUp, Float, Magnetic, Tilt } from "./motion-primitives";

const INBOX = [
  { name: "Aarav Textiles", msg: "Do you have the blue silk in stock?", time: "now", unread: 2, hue: "from-amber-400 to-rose-500" },
  { name: "Neha Gupta", msg: "Loved the festive collection 😍", time: "2m", unread: 0, hue: "from-brand-400 to-emerald-600" },
  { name: "Studio Décor", msg: "Can we reorder the diyas?", time: "11m", unread: 1, hue: "from-sky-400 to-indigo-500" },
];

const EASE = [0.22, 1, 0.36, 1] as const;

export function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const yUp = useTransform(scrollYProgress, [0, 1], [0, -70]);
  const yDown = useTransform(scrollYProgress, [0, 1], [0, 50]);

  return (
    <section
      ref={ref}
      className="bg-mesh relative overflow-hidden pb-16 pt-32 sm:pb-24 sm:pt-40"
    >
      {/* ambient layers */}
      <div className="bg-dotgrid pointer-events-none absolute inset-0 opacity-50" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-cream to-transparent" />

      <div className="relative z-10 mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-14 px-5 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
        {/* ---------------- Copy ---------------- */}
        <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
          <motion.a
            href="#get-started"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="group inline-flex items-center gap-2 rounded-full border border-brand-200/70 bg-white/70 py-1.5 pl-2 pr-3.5 text-[13px] font-semibold text-brand-700 shadow-soft backdrop-blur"
          >
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-500 px-2 py-0.5 text-[11px] font-bold text-white">
              <Sparkles className="h-3 w-3" /> NEW
            </span>
            Now in early access · WhatsApp Business Platform
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </motion.a>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.08, ease: EASE }}
            className="mt-6 max-w-2xl text-balance text-5xl font-semibold leading-[1.04] tracking-tight text-ink sm:text-6xl lg:text-[4.1rem]"
          >
            The WhatsApp CRM your{" "}
            <span className="relative whitespace-nowrap">
              <span className="font-display text-gradient italic">
                whole team
              </span>
              <svg
                viewBox="0 0 300 14"
                className="absolute -bottom-2 left-0 h-3 w-full text-brand-300"
                fill="none"
                preserveAspectRatio="none"
              >
                <path
                  d="M2 9c60-6 236-6 296 0"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </span>{" "}
            runs on.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.16, ease: EASE }}
            className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-ink/60 sm:text-xl"
          >
            Unify every conversation, lead, and campaign in one shared inbox.
            Nudge adds AI replies, automated follow-ups, and revenue analytics —
            and keeps you Meta-compliant on every single send.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.24, ease: EASE }}
            className="mt-9 flex flex-col items-center gap-3 sm:flex-row lg:items-start"
          >
            <Magnetic>
              <ButtonLink href="#get-started" variant="primary" size="lg">
                Book a demo
                <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
              </ButtonLink>
            </Magnetic>
            <ButtonLink href="#showcase" variant="secondary" size="lg">
              See it in action
            </ButtonLink>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:gap-6 lg:items-start"
          >
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2.5">
                {["from-amber-400 to-rose-500", "from-brand-400 to-emerald-600", "from-sky-400 to-indigo-500", "from-fuchsia-400 to-purple-600"].map(
                  (h, i) => (
                    <span
                      key={i}
                      className={`h-8 w-8 rounded-full bg-gradient-to-br ${h} ring-2 ring-white`}
                    />
                  )
                )}
              </div>
              <div className="text-left">
                <div className="flex items-center gap-0.5 text-amber-400">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-current" />
                  ))}
                </div>
                <p className="text-[13px] font-medium text-ink/55">
                  Trusted by fast-growing retail & D2C teams
                </p>
              </div>
            </div>
          </motion.div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px] font-medium text-ink/55 lg:justify-start">
            {[
              { icon: CheckCircle2, label: "No credit card" },
              { icon: ShieldCheck, label: "Meta-compliant" },
              { icon: Zap, label: "Works in simulation first" },
            ].map(({ icon: Icon, label }) => (
              <span key={label} className="inline-flex items-center gap-1.5">
                <Icon className="h-4 w-4 text-brand-500" />
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* ---------------- Visual stage ---------------- */}
        <div className="relative mx-auto flex w-full max-w-md items-center justify-center lg:max-w-none">
          <div className="relative w-full">
            {/* glow */}
            <div className="absolute left-1/2 top-1/2 h-[120%] w-[120%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-300/30 blur-3xl" />

            <Tilt className="relative">
              {/* Team inbox panel */}
              <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.9, delay: 0.2, ease: EASE }}
                className="relative z-10 rounded-[2rem] border border-black/5 bg-white/90 p-3 shadow-lift backdrop-blur-xl"
              >
                <div className="flex items-center justify-between px-3 pb-3 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-brand-400" />
                  </div>
                  <p className="text-[12.5px] font-semibold text-ink/50">
                    Team Inbox · <span className="text-brand-600">3 unread</span>
                  </p>
                </div>

                <div className="space-y-1.5">
                  {INBOX.map((row, i) => (
                    <motion.div
                      key={row.name}
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.6, delay: 0.45 + i * 0.12, ease: EASE }}
                      className={`flex items-center gap-3 rounded-2xl border p-3 transition-colors ${
                        i === 0
                          ? "border-brand-200 bg-brand-50/70"
                          : "border-transparent bg-black/[0.02] hover:bg-black/[0.04]"
                      }`}
                    >
                      <span
                        className={`grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br ${row.hue} text-sm font-bold text-white`}
                      >
                        {row.name[0]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-[13.5px] font-semibold text-ink">
                            {row.name}
                          </p>
                          <span className="shrink-0 text-[11px] text-ink/40">
                            {row.time}
                          </span>
                        </div>
                        <p className="truncate text-[12.5px] text-ink/55">
                          {row.msg}
                        </p>
                      </div>
                      {row.unread > 0 && (
                        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand-500 px-1.5 text-[11px] font-bold text-white">
                          {row.unread}
                        </span>
                      )}
                    </motion.div>
                  ))}
                </div>

                <div className="mt-2 flex items-center gap-2 rounded-2xl border border-black/5 bg-white p-2 pl-3.5">
                  <Sparkles className="h-4 w-4 text-brand-500" />
                  <p className="flex-1 text-[12.5px] text-ink/45">
                    AI suggested: “Yes! The blue silk is back in stock…”
                  </p>
                  <span className="rounded-lg bg-brand-500 px-2.5 py-1.5 text-[11px] font-bold text-white">
                    Send
                  </span>
                </div>
              </motion.div>

              {/* Floating WhatsApp card */}
              <motion.div
                style={{ y: yUp }}
                className="absolute -bottom-10 -right-4 z-20 hidden w-[230px] sm:block lg:-right-12"
              >
                <Float delay={0.4} amount={12}>
                  <div className="rotate-3">
                    <WhatsAppCard className="max-w-[230px] scale-95" />
                  </div>
                </Float>
              </motion.div>
            </Tilt>

            {/* Floating KPI chip */}
            <motion.div
              style={{ y: yDown }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.8, ease: EASE }}
              className="absolute -left-4 -top-6 z-30 lg:-left-12"
            >
              <Float delay={0} amount={10}>
                <div className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white/90 px-4 py-3 shadow-lift backdrop-blur-xl">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-100 text-brand-600">
                    <Zap className="h-[18px] w-[18px]" fill="currentColor" />
                  </span>
                  <div>
                    <p className="text-[11px] font-medium text-ink/45">
                      Avg. open rate
                    </p>
                    <p className="text-lg font-bold text-ink">
                      <CountUp to={98} suffix="%" />
                    </p>
                  </div>
                </div>
              </Float>
            </motion.div>

            {/* Floating automation chip */}
            <motion.div
              style={{ y: yUp }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 1, ease: EASE }}
              className="absolute -bottom-4 left-2 z-30 hidden md:block lg:-left-8"
            >
              <Float delay={1.2} amount={9}>
                <div className="flex items-center gap-2.5 rounded-2xl border border-black/5 bg-white/90 px-4 py-3 shadow-lift backdrop-blur-xl">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-500" />
                  </span>
                  <p className="text-[12.5px] font-semibold text-ink">
                    Auto follow-up sent
                  </p>
                </div>
              </Float>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
