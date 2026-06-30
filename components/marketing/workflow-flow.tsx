"use client";

import { motion } from "motion/react";
import {
  Filter,
  MessageSquarePlus,
  Repeat,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { Container, Section, SectionHeading } from "./section";
import { Reveal } from "./motion-primitives";

const STEPS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: MessageSquarePlus,
    title: "Capture",
    body: "Every message, ad click and form lands as a lead — automatically, with full context.",
  },
  {
    icon: Filter,
    title: "Qualify",
    body: "Nudge tags, scores and routes each lead to the right teammate in seconds.",
  },
  {
    icon: Sparkles,
    title: "Engage",
    body: "AI drafts on-brand replies and turns a single photo into a ready campaign.",
  },
  {
    icon: Repeat,
    title: "Automate",
    body: "Follow-ups, reminders and re-engagement fire on schedule — never chased by hand.",
  },
  {
    icon: TrendingUp,
    title: "Convert",
    body: "Close the sale, then see the revenue, reads and exact ₹ cost behind it.",
  },
];

export function WorkflowFlow() {
  return (
    <Section id="workflow" className="bg-cream">
      <Container>
        <SectionHeading
          eyebrow="From first message to closed sale"
          title={
            <>
              Your whole sales motion,{" "}
              <span className="text-gradient">on autopilot</span>
            </>
          }
          subtitle="Nudge connects the dots between a stranger's first “Hi” and a repeat customer — so nothing slips, and no one burns out chasing replies."
        />

        <div className="relative mt-16">
          {/* connector track (desktop) */}
          <div className="pointer-events-none absolute inset-x-[10%] top-7 hidden h-0.5 bg-brand-200/70 lg:block" />
          <div className="pointer-events-none absolute inset-x-[10%] top-7 hidden h-0.5 shimmer lg:block" />
          {/* traveling beam */}
          <motion.span
            aria-hidden
            className="pointer-events-none absolute top-[1.55rem] hidden h-3 w-3 rounded-full bg-brand-500 shadow-glow lg:block"
            style={{ marginLeft: "10%" }}
            animate={{ left: ["0%", "80%"] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
          />

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-5 lg:gap-4">
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.12} className="relative">
                <div className="flex flex-col items-center text-center">
                  <span className="relative grid h-14 w-14 place-items-center rounded-2xl border border-brand-200/70 bg-white text-brand-600 shadow-soft">
                    <span className="absolute inset-0 animate-pulse-glow rounded-2xl bg-brand-400/20" />
                    <s.icon className="relative h-6 w-6" />
                    <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-brand-500 text-[11px] font-bold text-white">
                      {i + 1}
                    </span>
                  </span>
                  <h3 className="mt-5 text-lg font-semibold text-ink">{s.title}</h3>
                  <p className="mt-2 max-w-[15rem] text-[14px] leading-relaxed text-ink/60">
                    {s.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        <Reveal delay={0.2} className="mt-14 flex justify-center">
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 rounded-3xl border border-black/5 bg-white px-8 py-5 shadow-soft">
            <p className="text-[14px] font-semibold text-ink/70">
              Triggers your team can set in a click:
            </p>
            {["No reply in 24h", "New lead from ad", "Cart abandoned", "Birthday", "Order delivered"].map(
              (t) => (
                <span
                  key={t}
                  className="rounded-full bg-brand-50 px-3.5 py-1.5 text-[13px] font-semibold text-brand-700"
                >
                  {t}
                </span>
              )
            )}
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}
