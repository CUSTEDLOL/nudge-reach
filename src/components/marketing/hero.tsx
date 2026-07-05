"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { ArrowRight, CalendarCheck, PhoneCall, ShieldCheck } from "lucide-react";
import { ButtonLink } from "./button";
import { AgentConversation } from "./agent-conversation";
import { Float, Magnetic } from "./motion-primitives";

const EASE = [0.22, 1, 0.36, 1] as const;

const PROOF = [
  { icon: CalendarCheck, label: "Books real appointments" },
  { icon: PhoneCall, label: "Chases quiet leads" },
  { icon: ShieldCheck, label: "Set up for you" },
];

export function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [0, -60]);

  return (
    <section
      ref={ref}
      className="bg-mesh relative overflow-hidden pb-16 pt-32 sm:pb-24 sm:pt-40"
    >
      <div className="bg-dotgrid pointer-events-none absolute inset-0 opacity-50" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-cream to-transparent" />

      <div className="relative z-10 mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-14 px-5 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
        {/* copy */}
        <div>
          <motion.span
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE }}
            className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/70 px-3.5 py-1.5 text-[13px] font-medium text-brand-700 shadow-soft backdrop-blur"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
            </span>
            Meta&apos;s free AI answers. Ours runs the whole desk.
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.06, ease: EASE }}
            className="mt-5 font-display text-[2.7rem] leading-[1.02] tracking-tight text-ink sm:text-6xl lg:text-[4.1rem]"
          >
            The AI employee that{" "}
            <span className="relative whitespace-nowrap text-brand-600">
              runs
              <svg
                className="absolute -bottom-1 left-0 h-[0.4em] w-full text-brand-300"
                viewBox="0 0 100 12"
                preserveAspectRatio="none"
                aria-hidden
              >
                <path
                  d="M1 8 Q 25 2 50 6 T 99 5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </span>{" "}
            your WhatsApp.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.14, ease: EASE }}
            className="mt-6 max-w-xl text-lg leading-relaxed text-ink/70"
          >
            It books into your real calendar, chases every lead that goes quiet,
            and collects payments — and we set the whole thing up for you. A
            front-desk hire costs <strong className="text-ink">₹22,000/mo</strong>.
            Nudge is <strong className="text-ink">₹14,999</strong>, and never
            sleeps.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.22, ease: EASE }}
            className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <Magnetic>
              <ButtonLink href="/login" size="lg">
                Start free
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-1" />
              </ButtonLink>
            </Magnetic>
            <ButtonLink href="#salary" variant="secondary" size="lg">
              See the salary math
            </ButtonLink>
          </motion.div>

          <motion.ul
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.9, delay: 0.34 }}
            className="mt-8 flex flex-wrap gap-x-6 gap-y-2"
          >
            {PROOF.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2 text-sm text-ink/60">
                <Icon className="h-4 w-4 text-brand-500" aria-hidden />
                {label}
              </li>
            ))}
          </motion.ul>
        </div>

        {/* the product IS the hero */}
        <motion.div
          style={{ y }}
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.15, ease: EASE }}
        >
          <Float amount={10} duration={8}>
            <AgentConversation />
          </Float>
        </motion.div>
      </div>
    </section>
  );
}
