"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Crown, Sparkles } from "lucide-react";
import { BookDemoButton } from "./book-demo";
import { Reveal } from "./motion-primitives";
import { RoiCalculator } from "./roi-calculator";
import { getPlan, planPrice } from "@/modules/billing/plans";
import { cn } from "@/lib/cn";

type Currency = "INR" | "USD";

type Tier = {
  planId: string; // maps to lib/billing/plans for the price — one source of truth
  name: string;
  tagline: string;
  priceNote: string;
  popular?: boolean;
  featureIntro?: string;
  features: string[];
};

const TIERS: Tier[] = [
  {
    planId: "free",
    name: "Free",
    tagline: "Run WhatsApp properly from day one. No card, no expiry.",
    priceNote: "forever",
    features: [
      "1 WhatsApp number",
      "250 contacts",
      "500 campaign messages/mo",
      "Shared inbox + AI reply drafts",
      "2 automations",
      "2 team seats",
    ],
  },
  {
    planId: "starter",
    name: "Starter",
    tagline: "For small teams making WhatsApp their main sales channel.",
    priceNote: "/month",
    featureIntro: "Everything in Free, plus:",
    features: [
      "2,500 contacts",
      "3,000 campaign messages/mo",
      "5 team seats",
      "Unlimited automations",
      "Broadcasts + scheduling",
    ],
  },
  {
    planId: "growth",
    name: "Growth",
    tagline: "For businesses running WhatsApp at serious volume.",
    priceNote: "/month",
    popular: true,
    featureIntro: "Everything in Starter, plus:",
    features: [
      "25,000 contacts",
      "30,000 campaign messages/mo",
      "15 team seats",
      "Webhooks + API access",
      "Analytics & agent performance",
    ],
  },
  {
    planId: "pro",
    name: "Pro",
    tagline: "For brands where WhatsApp is the revenue engine.",
    priceNote: "/month",
    featureIntro: "Everything in Growth, plus:",
    features: [
      "Unlimited contacts",
      "Unlimited campaign messages",
      "Unlimited team seats",
      "Priority support",
    ],
  },
];

function priceLabel(planId: string, currency: Currency): string {
  const price = planPrice(getPlan(planId), currency);
  if (currency === "USD") return `$${price.toLocaleString("en-US")}`;
  return `₹${price.toLocaleString("en-IN")}`;
}

/** Square bento check — the theme's tick, not a soft round one. */
function CheckSquare({ tint = "#7ee2a8" }: { tint?: string }) {
  return (
    <span
      className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 border-ink/70 text-ink"
      style={{ background: tint }}
    >
      <Check className="h-3 w-3" strokeWidth={3.5} />
    </span>
  );
}

/**
 * Pricing grid + ROI calculator behind ONE currency toggle (global outreach):
 * ₹ for India, $ for everywhere else. Client component so the toggle is
 * instant; prices come from lib/billing/plans so marketing can't drift from
 * what the app actually charges.
 */
export function PricingTiers() {
  const [currency, setCurrency] = useState<Currency>("INR");

  return (
    <>
      {/* Currency toggle */}
      <div className="mt-10 flex justify-center">
        <div
          role="radiogroup"
          aria-label="Pricing currency"
          className="inline-flex items-center gap-1 rounded-full border-2 border-ink/70 bg-white p-1 shadow-[4px_4px_0_rgba(10,15,13,0.82)]"
        >
          {(
            [
              { value: "INR", label: "₹ India" },
              { value: "USD", label: "$ International" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={currency === opt.value}
              onClick={() => setCurrency(opt.value)}
              className={cn(
                "rounded-full px-4 py-2 font-mono text-[11px] font-black uppercase tracking-[0.08em] transition-colors duration-150",
                currency === opt.value
                  ? "bg-ink text-white"
                  : "text-ink/55 hover:text-ink"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Flagship — the hero tier (done-for-you AI Front Desk) */}
      <Reveal className="mt-10">
        <article
          className="relative overflow-hidden rounded-[1.75rem] border-2 border-ink/70 p-6 shadow-[9px_9px_0_rgba(10,15,13,0.82)] sm:p-9"
          style={{
            background:
              "linear-gradient(135deg, #54e58b 0%, #8eec72 48%, #c9f34f 100%)",
          }}
        >
          {/* ghost word — the theme's giant backdrop */}
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-8 right-2 select-none font-display text-[clamp(6rem,14vw,11rem)] font-black leading-none tracking-[-0.06em] text-white/25"
          >
            24/7
          </span>

          <div className="relative z-10 grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-center">
            <div>
              <span className="inline-flex -rotate-2 items-center gap-1.5 rounded-full border-2 border-ink/70 bg-white px-3.5 py-1.5 font-mono text-[10px] font-black uppercase tracking-[0.12em] text-ink shadow-[3px_3px_0_rgba(10,15,13,0.35)]">
                <Crown className="h-3.5 w-3.5" aria-hidden />
                Flagship · Done for you
              </span>
              <h3 className="mt-4 font-display text-[2.2rem] font-black uppercase leading-[0.9] tracking-[-0.04em] text-ink sm:text-[3rem]">
                AI Front Desk
              </h3>
              <p className="mt-3 max-w-md text-[14.5px] font-medium leading-relaxed text-ink/75">
                Your AI employee. It answers, books, chases and collects — and
                we set the whole thing up for you.
              </p>
              <div className="mt-6 flex items-end gap-2">
                <span className="font-display text-[3.4rem] font-black leading-none tracking-[-0.03em] text-ink">
                  {priceLabel("front_desk", currency)}
                </span>
                <span className="mb-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-ink/60">
                  /month
                </span>
              </div>
              <BookDemoButton className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-ink/80 bg-[#ffd94a] px-7 text-[13.5px] font-black uppercase tracking-[0.08em] text-ink shadow-[0_4px_0_rgba(10,15,13,0.8)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#ffe37a] hover:shadow-[0_6px_0_rgba(10,15,13,0.8)] active:translate-y-0 active:shadow-[0_2px_0_rgba(10,15,13,0.8)]">
                <Sparkles className="h-4 w-4" aria-hidden />
                Book a setup call
              </BookDemoButton>
            </div>

            <ul className="grid gap-2.5 rounded-2xl border-2 border-ink/25 bg-white/55 p-5 backdrop-blur-sm sm:grid-cols-2 sm:p-6 lg:grid-cols-1 xl:grid-cols-2">
              {getPlan("front_desk").features.map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <CheckSquare tint="#ffd94a" />
                  <span className="text-[13px] font-semibold leading-snug text-ink/80">
                    {f}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </article>
      </Reveal>

      <Reveal className="mt-14 text-center">
        <span className="inline-block rotate-1 rounded-full border-2 border-ink/70 bg-white px-4 py-1.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink shadow-[3px_3px_0_rgba(10,15,13,0.82)]">
          Or start self-serve · free
        </span>
      </Reveal>

      <div className="mt-8 grid items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
        {TIERS.map((tier, i) => (
          <Reveal key={tier.name} delay={i * 0.08} className="h-full">
            <div
              className={cn(
                "flex h-full flex-col rounded-[1.5rem] border-2 border-ink/70 p-6 shadow-[7px_7px_0_rgba(10,15,13,0.82)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[9px_11px_0_rgba(10,15,13,0.82)]",
                tier.popular ? "" : "bg-white"
              )}
              style={
                tier.popular
                  ? {
                      background:
                        "linear-gradient(145deg, #fff3c4 0%, #ffe08a 100%)",
                    }
                  : undefined
              }
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-[1.4rem] font-black uppercase leading-none tracking-[-0.03em] text-ink">
                  {tier.name}
                </h3>
                {tier.popular && (
                  <span className="inline-flex -rotate-2 items-center gap-1 rounded-full border-2 border-ink/70 bg-ink px-2.5 py-1 font-mono text-[9px] font-black uppercase tracking-[0.1em] text-white">
                    <Sparkles className="h-3 w-3" /> Popular
                  </span>
                )}
              </div>
              <p className="mt-2 min-h-[3.5rem] text-[13px] font-medium leading-snug text-ink/60">
                {tier.tagline}
              </p>

              <div className="mt-4 flex items-end gap-1.5">
                <span className="font-display text-[2.2rem] font-black leading-none tracking-[-0.03em] text-ink">
                  {priceLabel(tier.planId, currency)}
                </span>
                <span className="mb-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink/50">
                  {tier.priceNote}
                </span>
              </div>

              <Link
                href="/login"
                className={cn(
                  "mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl border-2 border-ink/80 text-[12.5px] font-black uppercase tracking-[0.08em] transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0",
                  tier.popular
                    ? "bg-ink text-white shadow-[0_4px_0_rgba(10,15,13,0.35)] hover:shadow-[0_6px_0_rgba(10,15,13,0.35)] active:shadow-[0_2px_0_rgba(10,15,13,0.35)]"
                    : "bg-white text-ink shadow-[0_4px_0_rgba(10,15,13,0.8)] hover:bg-[#f1f7ec] hover:shadow-[0_6px_0_rgba(10,15,13,0.8)] active:shadow-[0_2px_0_rgba(10,15,13,0.8)]"
                )}
              >
                Start free
              </Link>

              {tier.featureIntro && (
                <p className="mt-6 font-mono text-[10px] font-black uppercase tracking-[0.1em] text-ink/45">
                  {tier.featureIntro}
                </p>
              )}
              <ul className={cn("space-y-2.5", tier.featureIntro ? "mt-3" : "mt-6")}>
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <CheckSquare />
                    <span className="text-[13px] font-semibold leading-snug text-ink/70">
                      {f}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal delay={0.15} className="mt-8 text-center">
        <p className="mx-auto max-w-2xl font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-ink/45">
          Billed monthly · Cancel anytime · Official WhatsApp Cloud API on every
          plan
        </p>
      </Reveal>

      <Reveal delay={0.1} className="mt-16 sm:mt-20">
        <RoiCalculator currency={currency} />
      </Reveal>
    </>
  );
}
