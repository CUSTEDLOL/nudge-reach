"use client";

import { useState } from "react";
import { Calculator, TrendingUp } from "lucide-react";
import { getPlan, planPrice } from "@/modules/billing/plans";

/**
 * Conservative, fully-disclosed assumption set. One lever only:
 * a fixed share of monthly leads recovered by instant replies + follow-ups.
 * Currency follows the pricing section's toggle (global outreach).
 */
const RECOVERY_RATE = 0.12;

const CURRENCY_DEFAULTS = {
  INR: { symbol: "\u20b9", locale: "en-IN", defaultAov: "1499" },
  USD: { symbol: "$", locale: "en-US", defaultAov: "49" },
} as const;

export type RoiCurrency = keyof typeof CURRENCY_DEFAULTS;

/** Round the estimate so it never pretends to be precise. */
function roundEstimate(v: number) {
  if (v >= 100_000) return Math.round(v / 1000) * 1000;
  if (v >= 10_000) return Math.round(v / 500) * 500;
  return Math.round(v / 100) * 100;
}

export function RoiCalculator({
  currency = "INR",
}: {
  currency?: RoiCurrency;
}) {
  const [leads, setLeads] = useState(500);
  const [aovText, setAovText] = useState<string>(
    CURRENCY_DEFAULTS.INR.defaultAov
  );

  const { symbol, locale, defaultAov } = CURRENCY_DEFAULTS[currency];
  const growthPrice = planPrice(getPlan("growth"), currency);

  // Currency switch resets the order-value default (a sensible anchor per
  // market) — React's adjust-state-during-render pattern, no effect needed.
  const [prevCurrency, setPrevCurrency] = useState<RoiCurrency>(currency);
  if (prevCurrency !== currency) {
    setPrevCurrency(currency);
    setAovText(defaultAov);
  }

  const aov = Math.min(100_000, Math.max(0, Number(aovText) || 0));
  const recoveredLeads = Math.round(leads * RECOVERY_RATE);
  const revenue = recoveredLeads * aov;
  const estimate = roundEstimate(revenue);
  const multiple = revenue / growthPrice;
  const multipleLabel =
    multiple >= 10 ? `${Math.round(multiple)}×` : `${multiple.toFixed(1)}×`;

  return (
    <div className="overflow-hidden rounded-3xl border border-black/5 bg-white shadow-soft">
      <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
        {/* ---------------- Inputs ---------------- */}
        <div className="p-6 sm:p-8">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-200/70 bg-brand-50 px-3.5 py-1.5 text-[13px] font-semibold text-brand-700">
            <Calculator className="h-3.5 w-3.5" /> Quick maths
          </span>
          <h3 className="mt-4 text-2xl font-semibold tracking-tight text-ink sm:text-[1.7rem]">
            Will it pay for itself?
          </h3>
          <p className="mt-2 text-[14.5px] leading-relaxed text-ink/60">
            Put in your own numbers. We&apos;ll show what recovering even a small
            share of missed leads is worth each month.
          </p>

          <div className="mt-7 space-y-6">
            <label className="block">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[13px] font-semibold text-ink/60">
                  Monthly leads / enquiries
                </span>
                <span className="text-lg font-bold tracking-tight text-ink">
                  {leads.toLocaleString(locale)}
                </span>
              </div>
              <input
                type="range"
                min={50}
                max={5000}
                step={50}
                value={leads}
                onChange={(e) => setLeads(Number(e.target.value))}
                aria-label="Monthly leads or enquiries"
                className="mt-3 h-2 w-full cursor-pointer appearance-auto accent-brand-500"
              />
              <div className="mt-1.5 flex justify-between text-[11px] font-medium text-ink/35">
                <span>50</span>
                <span>5,000</span>
              </div>
            </label>

            <label className="block">
              <span className="text-[13px] font-semibold text-ink/60">
                Average order value
              </span>
              <div className="mt-2 flex max-w-[14rem] items-center rounded-xl border border-black/10 bg-white shadow-sm transition-colors focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-100">
                <span className="pl-3.5 text-[15px] font-semibold text-ink/40">
                  {symbol}
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={100000}
                  value={aovText}
                  onChange={(e) => setAovText(e.target.value)}
                  aria-label="Average order value"
                  className="w-full rounded-xl border-0 bg-transparent px-2 py-3 text-[15px] font-semibold text-ink outline-none"
                />
              </div>
            </label>
          </div>

          <div className="mt-7 rounded-2xl border border-brand-100 bg-brand-50/60 p-4 sm:p-5">
            <p className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-brand-700">
              Our assumptions, on the table
            </p>
            <ul className="mt-2.5 list-disc space-y-1.5 pl-4 text-[13px] leading-relaxed text-ink/60">
              <li>
                WhatsApp messages are opened ~98% of the time; email manages
                ~20%.
              </li>
              <li>
                We assume a conservative 12% of your leads are recovered by
                instant replies and timely follow-ups.
              </li>
              <li>
                Recovered leads × your order value = the estimate. Nothing else
                is baked in.
              </li>
            </ul>
          </div>
        </div>

        {/* ---------------- Result ---------------- */}
        <div className="relative overflow-hidden bg-brand-950 p-6 text-white sm:p-8 lg:flex lg:flex-col lg:justify-center">
          <div className="bg-linegrid pointer-events-none absolute inset-0 opacity-40" />
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brand-500/20 blur-[90px]" />

          <div className="relative">
            <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-brand-300">
              Estimated recovered revenue
            </p>
            <p className="mt-3 text-4xl font-bold leading-none tracking-tight sm:text-5xl">
              ~{symbol}{estimate.toLocaleString(locale)}
              <span className="ml-1.5 text-lg font-semibold text-brand-100/60">
                /month
              </span>
            </p>
            <p className="mt-3 text-[14.5px] leading-relaxed text-brand-100/70">
              That&apos;s roughly{" "}
              <span className="font-semibold text-white">
                {recoveredLeads.toLocaleString(locale)} extra orders
              </span>{" "}
              a month at {symbol}{aov.toLocaleString(locale)} each.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-white/10 pt-6">
              <div>
                <p className="text-[12px] text-brand-100/55">Growth plan</p>
                <p className="text-lg font-bold">
                  {symbol}{growthPrice.toLocaleString(locale)}
                  <span className="text-[13px] font-medium text-brand-100/55">
                    /mo
                  </span>
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-400/15 px-3.5 py-1.5 text-[13px] font-bold text-brand-300 ring-1 ring-inset ring-brand-400/30">
                <TrendingUp className="h-4 w-4" />≈ {multipleLabel} the plan
                cost
              </span>
            </div>

            <p className="mt-6 text-[12.5px] leading-relaxed text-brand-100/50">
              An estimate, not a promise — actual recovery depends on your list
              quality, your offer and how fast you follow up. That last part is
              the bit Nudge fixes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
