"use client";

import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { ButtonLink } from "./button";
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
    tagline: "Run WhatsApp properly from day one, no card, no expiry.",
    priceNote: "free forever",
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
    priceNote: "per month",
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
    priceNote: "per month",
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
    priceNote: "per month",
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
          className="inline-flex items-center rounded-full border border-black/10 bg-white p-1 shadow-soft"
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
                "rounded-full px-4 py-2 text-[13.5px] font-semibold transition-colors duration-150",
                currency === opt.value
                  ? "bg-brand-950 text-white"
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
        <div className="bg-mesh relative overflow-hidden rounded-[2rem] bg-brand-950 p-7 shadow-lift sm:p-9">
          <div className="relative z-10 grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-center">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-400 px-3 py-1 text-[11px] font-bold text-brand-950">
                <Sparkles className="h-3 w-3" /> Flagship · done for you
              </span>
              <h3 className="mt-4 font-display text-3xl text-white sm:text-4xl">
                AI Front Desk
              </h3>
              <p className="mt-3 max-w-md text-[15px] leading-relaxed text-brand-100/80">
                Your AI employee: it books, chases and collects, and we set the
                whole thing up. Priced against the hire it replaces, not against
                software.
              </p>
              <div className="mt-6 flex items-end gap-1.5">
                <span className="font-display text-5xl leading-none text-white">
                  {priceLabel("front_desk", currency)}
                </span>
                <span className="mb-1 text-[13px] text-brand-100/60">per month</span>
              </div>
              <BookDemoButton variant="primary-dark" size="lg" className="mt-6">
                Book a setup call
              </BookDemoButton>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {getPlan("front_desk").features.map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-400/20 text-brand-300">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  <span className="text-[13.5px] leading-snug text-brand-100/85">
                    {f}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Reveal>

      <Reveal className="mt-14 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-ink/40">
          Or start self-serve
        </p>
      </Reveal>

      <div className="mt-6 grid items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4 xl:gap-5">
        {TIERS.map((tier, i) => {
          const card = (
            <div
              className={cn(
                "flex h-full flex-col rounded-[1.75rem] p-6 xl:p-7",
                tier.popular
                  ? "bg-brand-950 text-white shadow-lift"
                  : "border border-black/5 bg-white shadow-soft"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <h3
                  className={cn(
                    "text-lg font-semibold",
                    tier.popular ? "text-white" : "text-ink"
                  )}
                >
                  {tier.name}
                </h3>
                {tier.popular && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-400 px-3 py-1 text-[11px] font-bold text-brand-950">
                    <Sparkles className="h-3 w-3" /> Most popular
                  </span>
                )}
              </div>
              <p
                className={cn(
                  "mt-2 min-h-[3.5rem] text-[13.5px] leading-snug",
                  tier.popular ? "text-brand-100/70" : "text-ink/55"
                )}
              >
                {tier.tagline}
              </p>

              <div className="mt-5 flex items-end gap-1.5">
                <span
                  className={cn(
                    "text-[2.15rem] font-bold leading-none tracking-tight",
                    tier.popular ? "text-white" : "text-ink"
                  )}
                >
                  {priceLabel(tier.planId, currency)}
                </span>
                <span
                  className={cn(
                    "mb-0.5 text-[13px]",
                    tier.popular ? "text-brand-100/60" : "text-ink/45"
                  )}
                >
                  {tier.priceNote}
                </span>
              </div>

              <ButtonLink
                href="/login"
                variant={tier.popular ? "primary-dark" : "secondary"}
                className="mt-6 w-full"
              >
                Start free
              </ButtonLink>

              {tier.featureIntro && (
                <p
                  className={cn(
                    "mt-6 text-[12px] font-bold uppercase tracking-[0.12em]",
                    tier.popular ? "text-brand-300" : "text-brand-700"
                  )}
                >
                  {tier.featureIntro}
                </p>
              )}
              <ul className={cn("space-y-2.5", tier.featureIntro ? "mt-3" : "mt-6")}>
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <span
                      className={cn(
                        "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full",
                        tier.popular
                          ? "bg-brand-400/20 text-brand-300"
                          : "bg-brand-100 text-brand-600"
                      )}
                    >
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    <span
                      className={cn(
                        "text-[13.5px] leading-snug",
                        tier.popular ? "text-brand-100/85" : "text-ink/70"
                      )}
                    >
                      {f}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );

          return (
            <Reveal key={tier.name} delay={i * 0.08} className="h-full">
              {tier.popular ? (
                <div className="relative h-full rounded-[1.85rem] border border-brand-400/60 bg-brand-950 shadow-[0_24px_60px_-24px_rgba(6,193,103,0.45)]">
                  {card}
                </div>
              ) : (
                card
              )}
            </Reveal>
          );
        })}
      </div>

      <Reveal delay={0.15} className="mt-8 text-center">
        <p className="text-[13.5px] text-ink/50">
          Prices in {currency === "USD" ? "USD" : "INR"}, billed monthly, cancel
          anytime. Every plan includes simulation mode, opt-in enforcement and
          the official WhatsApp Cloud API.
        </p>
      </Reveal>

      <Reveal delay={0.1} className="mt-16 sm:mt-20">
        <RoiCalculator currency={currency} />
      </Reveal>
    </>
  );
}
