"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import {
  CheckCircle2,
  Clock,
  Headset,
  Star,
  Target,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { Container, Section, SectionHeading } from "./section";
import { Reveal } from "./motion-primitives";
import { cn } from "@/lib/cn";

type Persona = "sales" | "support";

const CONTENT: Record<
  Persona,
  { icon: LucideIcon; label: string; points: string[] }
> = {
  sales: {
    icon: Target,
    label: "For Sales",
    points: [
      "Hot leads routed instantly — with alerts before they go cold",
      "Close faster with AI replies, quick templates and saved offers",
      "A live pipeline and forecast your whole team can see",
      "Automated follow-ups that nudge until the deal is won",
    ],
  },
  support: {
    icon: Headset,
    label: "For Support",
    points: [
      "One shared queue — no double replies, no dropped tickets",
      "Canned answers and AI drafts for the questions you get daily",
      "Assignment rules and SLAs so nothing waits too long",
      "CSAT and response-time analytics on every conversation",
    ],
  },
};

const EASE = [0.22, 1, 0.36, 1] as const;

export function TeamBenefits() {
  const [persona, setPersona] = useState<Persona>("sales");
  const data = CONTENT[persona];

  return (
    <Section id="teams" className="bg-white">
      <Container>
        <SectionHeading
          eyebrow="Built for the whole team"
          title={
            <>
              One platform. <span className="text-gradient">Two superpowers.</span>
            </>
          }
          subtitle="Sales closes more. Support resolves faster. Both work from the same conversations — so your customer never has to repeat themselves."
        />

        <Reveal delay={0.1} className="mt-10 flex justify-center">
          <div className="inline-flex gap-1 rounded-full border border-black/5 bg-brand-50/70 p-1">
            {(Object.keys(CONTENT) as Persona[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPersona(p)}
                className={cn(
                  "relative inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors",
                  persona === p ? "text-white" : "text-ink/60 hover:text-ink"
                )}
              >
                {persona === p && (
                  <motion.span
                    layoutId="persona-pill"
                    className="absolute inset-0 rounded-full bg-brand-500 shadow-soft"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                {(() => {
                  const Icon = CONTENT[p].icon;
                  return <Icon className="relative h-4 w-4" />;
                })()}
                <span className="relative">{CONTENT[p].label}</span>
              </button>
            ))}
          </div>
        </Reveal>

        <div className="mt-12 grid items-center gap-10 lg:grid-cols-2">
          <AnimatePresence mode="wait">
            <motion.ul
              key={persona}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="space-y-4"
            >
              {data.points.map((point) => (
                <li key={point} className="flex items-start gap-3.5">
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-600">
                    <CheckCircle2 className="h-[18px] w-[18px]" />
                  </span>
                  <span className="text-[16px] leading-relaxed text-ink/75">
                    {point}
                  </span>
                </li>
              ))}
            </motion.ul>
          </AnimatePresence>

          <div className="relative">
            <div className="absolute inset-0 -z-10 rounded-[2rem] bg-gradient-to-br from-brand-100/60 to-transparent blur-2xl" />
            <AnimatePresence mode="wait">
              <motion.div
                key={persona}
                initial={{ opacity: 0, y: 18, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -18, scale: 0.97 }}
                transition={{ duration: 0.4, ease: EASE }}
              >
                {persona === "sales" ? <SalesVisual /> : <SupportVisual />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </Container>
    </Section>
  );
}

function StatTile({
  icon: Icon,
  value,
  label,
}: {
  icon: LucideIcon;
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-soft">
      <Icon className="h-5 w-5 text-brand-500" />
      <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
      <p className="text-[12.5px] text-ink/50">{label}</p>
    </div>
  );
}

function SalesVisual() {
  return (
    <div className="rounded-[2rem] border border-black/5 bg-white p-5 shadow-lift">
      <div className="flex items-center justify-between rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 p-4 text-white">
        <div>
          <p className="text-[12px] text-white/70">Deal won 🎉</p>
          <p className="text-lg font-bold">Aarav Textiles</p>
        </div>
        <p className="text-2xl font-bold">₹ 24,800</p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <StatTile icon={TrendingUp} value="+18%" label="Avg. deal size" />
        <StatTile icon={Clock} value="2.1 days" label="Faster to close" />
      </div>
    </div>
  );
}

function SupportVisual() {
  return (
    <div className="rounded-[2rem] border border-black/5 bg-white p-5 shadow-lift">
      <div className="rounded-2xl bg-brand-50/50 bg-dotgrid p-4">
        <div className="ml-auto max-w-[80%] rounded-2xl rounded-tr-sm bg-brand-500 px-3 py-2 text-[13px] text-white shadow-soft">
          Your order ships today — here&apos;s the tracking link 📦
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-brand-700">
          <CheckCircle2 className="h-4 w-4" /> Marked resolved
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <StatTile icon={Star} value="4.9 ★" label="Avg. CSAT" />
        <StatTile icon={Clock} value="2 min" label="First reply time" />
      </div>
    </div>
  );
}
