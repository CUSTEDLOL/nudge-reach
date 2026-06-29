"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import {
  BarChart3,
  CheckCheck,
  Inbox,
  Megaphone,
  Search,
  Send,
  Settings,
  Sparkles,
  TrendingUp,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { Container } from "./section";
import { CountUp, Reveal } from "./motion-primitives";
import { cn } from "@/lib/cn";

type Tab = "inbox" | "campaigns" | "analytics";

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "campaigns", label: "Campaigns", icon: Megaphone },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
];

const NAV: LucideIcon[] = [Inbox, Users, Megaphone, Workflow, BarChart3, Settings];

const EASE = [0.22, 1, 0.36, 1] as const;

export function DashboardShowcase() {
  const [tab, setTab] = useState<Tab>("inbox");

  return (
    <section
      id="showcase"
      className="relative scroll-mt-24 overflow-hidden bg-brand-950 py-24 sm:py-32"
    >
      <div className="bg-linegrid pointer-events-none absolute inset-0 opacity-60" />
      <div className="pointer-events-none absolute -left-40 top-0 h-96 w-96 rounded-full bg-brand-500/20 blur-[120px]" />
      <div className="pointer-events-none absolute -right-40 bottom-0 h-96 w-96 rounded-full bg-emerald-400/10 blur-[120px]" />

      <Container className="relative z-10">
        <Reveal className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-[13px] font-semibold text-brand-200">
            <Sparkles className="h-3.5 w-3.5" /> The product
          </span>
          <h2 className="text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            One calm screen for a noisy channel
          </h2>
          <p className="max-w-2xl text-pretty text-lg leading-relaxed text-brand-100/70">
            Inbox, campaigns and analytics — designed to feel effortless even on
            your busiest festive-season day. Take the tour.
          </p>
        </Reveal>

        {/* Tab switcher */}
        <Reveal delay={0.1} className="mt-10 flex justify-center">
          <div className="inline-flex gap-1 rounded-full border border-white/10 bg-white/5 p-1 backdrop-blur">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "relative inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors sm:px-5",
                  tab === t.id ? "text-brand-950" : "text-white/70 hover:text-white"
                )}
              >
                {tab === t.id && (
                  <motion.span
                    layoutId="tab-pill"
                    className="absolute inset-0 rounded-full bg-brand-400"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <t.icon className="relative h-4 w-4" />
                <span className="relative">{t.label}</span>
              </button>
            ))}
          </div>
        </Reveal>

        {/* App frame */}
        <Reveal delay={0.15} className="mt-10">
          <div className="mx-auto max-w-5xl overflow-hidden rounded-[1.75rem] border border-white/10 bg-white shadow-[0_40px_120px_-30px_rgba(0,0,0,0.6)]">
            {/* top bar */}
            <div className="flex items-center gap-3 border-b border-black/5 bg-white/80 px-4 py-3 backdrop-blur">
              <div className="flex gap-1.5">
                <span className="h-3 w-3 rounded-full bg-rose-400" />
                <span className="h-3 w-3 rounded-full bg-amber-400" />
                <span className="h-3 w-3 rounded-full bg-brand-400" />
              </div>
              <div className="mx-auto flex items-center gap-2 rounded-lg bg-black/5 px-3 py-1.5 text-[12px] font-medium text-ink/50">
                <span className="h-3 w-3 rounded-full bg-brand-400" />
                app.nudge.so/{tab}
              </div>
            </div>

            <div className="flex min-h-[420px]">
              {/* sidebar */}
              <div className="hidden w-16 flex-col items-center gap-1 border-r border-black/5 bg-brand-50/40 py-4 sm:flex">
                <div className="mb-2 grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-soft">
                  <Sparkles className="h-4 w-4" />
                </div>
                {NAV.map((Icon, i) => (
                  <button
                    key={i}
                    type="button"
                    tabIndex={-1}
                    aria-hidden
                    className={cn(
                      "grid h-10 w-10 place-items-center rounded-xl transition-colors",
                      i === (tab === "inbox" ? 0 : tab === "campaigns" ? 2 : 4)
                        ? "bg-brand-100 text-brand-700"
                        : "text-ink/35 hover:bg-black/5"
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </button>
                ))}
              </div>

              {/* main */}
              <div className="relative flex-1 overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={tab}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.35, ease: EASE }}
                    className="p-4 sm:p-6"
                  >
                    {tab === "inbox" && <InboxView />}
                    {tab === "campaigns" && <CampaignsView />}
                    {tab === "analytics" && <AnalyticsView />}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

/* ----------------------------- Inbox view ----------------------------- */
function InboxView() {
  const chats = [
    { n: "Aarav Textiles", m: "Do you have the blue silk?", t: "now", a: true, hue: "from-amber-400 to-rose-500" },
    { n: "Neha Gupta", m: "Loved the collection 😍", t: "2m", hue: "from-brand-400 to-emerald-600" },
    { n: "Studio Décor", m: "Reorder the diyas?", t: "11m", hue: "from-sky-400 to-indigo-500" },
    { n: "Karan M.", m: "What are your hours?", t: "26m", hue: "from-fuchsia-400 to-purple-600" },
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <div className="rounded-2xl border border-black/5 bg-white">
        <div className="flex items-center gap-2 border-b border-black/5 px-3 py-2.5">
          <Search className="h-4 w-4 text-ink/40" />
          <span className="text-[13px] text-ink/40">Search conversations</span>
        </div>
        <div className="p-1.5">
          {chats.map((c) => (
            <div
              key={c.n}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-2.5 py-2",
                c.a ? "bg-brand-50" : "hover:bg-black/[0.03]"
              )}
            >
              <span className={`grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br ${c.hue} text-[12px] font-bold text-white`}>
                {c.n[0]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-ink">{c.n}</p>
                <p className="truncate text-[12px] text-ink/50">{c.m}</p>
              </div>
              <span className="text-[10.5px] text-ink/40">{c.t}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col rounded-2xl border border-black/5 bg-brand-50/30 bg-dotgrid">
        <div className="flex items-center gap-2.5 border-b border-black/5 bg-white/70 px-4 py-3 backdrop-blur">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-rose-500 text-[12px] font-bold text-white">
            A
          </span>
          <div>
            <p className="text-[13px] font-semibold text-ink">Aarav Textiles</p>
            <p className="text-[11px] text-brand-600">● online · assigned to you</p>
          </div>
        </div>
        <div className="flex-1 space-y-2 p-4">
          <div className="max-w-[70%] rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-[13px] text-ink shadow-soft">
            Hi! Do you have the blue silk dupatta in stock?
          </div>
          <div className="ml-auto max-w-[72%] rounded-2xl rounded-tr-sm bg-brand-500 px-3 py-2 text-[13px] text-white shadow-soft">
            Yes Aarav! It&apos;s back in 6 shades. Want me to share the catalogue? 🛍️
            <span className="mt-1 flex items-center justify-end gap-1 text-[10px] text-white/70">
              10:32 <CheckCheck className="h-3 w-3" />
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 border-t border-black/5 bg-white/80 p-2.5 backdrop-blur">
          <div className="flex flex-1 items-center gap-2 rounded-full bg-brand-50 px-3 py-2">
            <Sparkles className="h-4 w-4 text-brand-500" />
            <span className="text-[12.5px] text-ink/50">
              AI reply ready — press to send
            </span>
          </div>
          <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-500 text-white shadow-soft">
            <Send className="h-4 w-4" />
          </span>
        </div>
      </div>
    </div>
  );
}

/* --------------------------- Campaigns view --------------------------- */
function CampaignsView() {
  const rows = [
    { n: "Diwali Festive Drop", s: "Sending", c: "bg-brand-500", p: "62%", a: "1,284" },
    { n: "New Arrivals — Silk", s: "Scheduled", c: "bg-amber-400", p: "—", a: "840" },
    { n: "Weekend Offer", s: "Completed", c: "bg-ink/30", p: "100%", a: "2,019" },
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
      <div className="rounded-2xl border border-black/5 bg-white">
        <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
          <p className="text-[13px] font-semibold text-ink">Campaigns</p>
          <span className="rounded-lg bg-brand-500 px-3 py-1.5 text-[12px] font-bold text-white">
            + New campaign
          </span>
        </div>
        <div className="divide-y divide-black/5">
          {rows.map((r) => (
            <div key={r.n} className="flex items-center gap-3 px-4 py-3">
              <span className={`h-2.5 w-2.5 rounded-full ${r.c}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-semibold text-ink">{r.n}</p>
                <p className="text-[11.5px] text-ink/45">{r.a} recipients</p>
              </div>
              <span className="rounded-full bg-black/5 px-2.5 py-1 text-[11px] font-semibold text-ink/60">
                {r.s}
              </span>
              <span className="w-10 text-right text-[12px] font-bold text-brand-600">
                {r.p}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-2xl border border-black/5 bg-brand-50/40 p-3">
        <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-ink/40">
          Live preview
        </p>
        <div className="overflow-hidden rounded-xl bg-white shadow-soft">
          <div className="h-20 bg-[linear-gradient(135deg,#c8a24a,#9c1f3a)]" />
          <div className="p-2.5">
            <p className="text-[12px] font-bold text-ink">✨ Diwali Drop, Priya!</p>
            <p className="mt-1 text-[11.5px] leading-snug text-ink/70">
              Festive silks just in — 10% off this week only. 🪔
            </p>
            <div className="mt-2 rounded-md border-t border-black/5 pt-1.5 text-center text-[11px] font-semibold text-brand-600">
              View collection
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-[12px] shadow-soft">
          <span className="text-ink/45">Est. cost</span>
          <span className="font-bold text-brand-600">₹ 899</span>
        </div>
      </div>
    </div>
  );
}

/* --------------------------- Analytics view --------------------------- */
function AnalyticsView() {
  const kpis = [
    { label: "Delivered", to: 98, suffix: "%", icon: CheckCheck },
    { label: "Read rate", to: 91, suffix: "%", icon: TrendingUp },
    { label: "Click rate", to: 34, suffix: "%", icon: BarChart3 },
    { label: "Revenue", to: 142, prefix: "₹", suffix: "k", icon: TrendingUp },
  ];
  const bars = [40, 58, 46, 72, 64, 88, 76, 94, 70, 82];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-black/5 bg-white p-3.5 shadow-soft">
            <div className="flex items-center justify-between">
              <span className="text-[11.5px] font-medium text-ink/45">{k.label}</span>
              <k.icon className="h-3.5 w-3.5 text-brand-500" />
            </div>
            <p className="mt-1 text-2xl font-bold text-ink">
              <CountUp to={k.to} prefix={k.prefix ?? ""} suffix={k.suffix} />
            </p>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-black/5 bg-white p-4">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold text-ink">Engagement · last 10 sends</p>
          <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700">
            ↑ 23% vs last month
          </span>
        </div>
        <div className="mt-4 flex h-32 items-end gap-2">
          {bars.map((h, i) => (
            <motion.div
              key={i}
              initial={{ height: 0 }}
              whileInView={{ height: `${h}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: i * 0.05, ease: EASE }}
              className="flex-1 rounded-t-md bg-gradient-to-t from-brand-600 to-brand-300"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
