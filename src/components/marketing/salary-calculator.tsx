"use client";

import { useState } from "react";
import { Container, Section, SectionHeading } from "./section";
import { Reveal } from "./motion-primitives";
import { PLAN_PRICES } from "@/modules/billing/plans";
import { formatPlanPrice, type Currency } from "@/modules/billing/money";

/** Markets we localise the salary math for, with a realistic front-desk wage
 *  (monthly, major units) and a sensible slider range. Conservative, editable. */
const MARKETS: Record<
  string,
  { currency: Currency; label: string; defaultSalary: number; min: number; max: number; step: number }
> = {
  IN: { currency: "INR", label: "🇮🇳 India", defaultSalary: 22000, min: 12000, max: 45000, step: 1000 },
  SG: { currency: "SGD", label: "🇸🇬 Singapore", defaultSalary: 2800, min: 1800, max: 4500, step: 100 },
  MY: { currency: "MYR", label: "🇲🇾 Malaysia", defaultSalary: 2500, min: 1500, max: 4500, step: 100 },
  AE: { currency: "AED", label: "🇦🇪 UAE", defaultSalary: 4000, min: 2500, max: 8000, step: 250 },
  US: { currency: "USD", label: "🇺🇸 US", defaultSalary: 3200, min: 2000, max: 6000, step: 100 },
};

export function SalaryCalculator() {
  const [market, setMarket] = useState<keyof typeof MARKETS>("IN");
  const m = MARKETS[market];
  const [salary, setSalary] = useState(m.defaultSalary);
  const [count, setCount] = useState(2);

  const nudge = PLAN_PRICES.front_desk[m.currency];
  const currentCost = salary * count;
  const monthlySaving = Math.max(0, currentCost - nudge);
  const annualSaving = monthlySaving * 12;

  function pick(key: keyof typeof MARKETS) {
    setMarket(key);
    setSalary(MARKETS[key].defaultSalary);
  }

  return (
    <Section id="salary" className="bg-cream">
      <Container>
        <SectionHeading
          eyebrow="The salary math"
          title="What your front desk costs. What it could."
          subtitle="Two numbers about your business today — and what changes the day the AI Front Desk clocks in."
        />

        <Reveal className="mx-auto mt-12 max-w-3xl">
          <div className="overflow-hidden rounded-3xl border border-black/10 bg-white p-6 shadow-soft sm:p-8">
            {/* market toggle */}
            <div className="flex flex-wrap gap-2">
              {Object.entries(MARKETS).map(([key, v]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => pick(key as keyof typeof MARKETS)}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    market === key
                      ? "bg-brand-500 text-white"
                      : "bg-black/5 text-ink/60 hover:bg-black/10"
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>

            {/* input 1: headcount */}
            <div className="mt-7">
              <div className="flex items-baseline justify-between">
                <label htmlFor="count-input" className="text-sm font-medium text-ink/70">
                  Front-desk employees you have
                </label>
                <span className="text-2xl font-bold tracking-tight text-ink">
                  {count}
                </span>
              </div>
              <input
                id="count-input"
                type="range"
                min={1}
                max={8}
                step={1}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="mt-3 w-full accent-brand-500"
                aria-label="Number of front-desk employees"
              />
            </div>

            {/* input 2: salary each */}
            <div className="mt-6">
              <div className="flex items-baseline justify-between">
                <label htmlFor="salary-input" className="text-sm font-medium text-ink/70">
                  What you pay each, monthly
                </label>
                <span className="text-2xl font-bold tracking-tight text-ink">
                  {formatPlanPrice(salary, m.currency)}
                  <span className="text-sm font-normal text-ink/40">/mo</span>
                </span>
              </div>
              <input
                id="salary-input"
                type="range"
                min={m.min}
                max={m.max}
                step={m.step}
                value={salary}
                onChange={(e) => setSalary(Number(e.target.value))}
                className="mt-3 w-full accent-brand-500"
                aria-label="Monthly front-desk salary"
              />
            </div>

            {/* the profit math */}
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-black/[0.03] p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-ink/45">
                  Your front desk today
                </p>
                <p className="mt-1 text-3xl font-bold tracking-tight text-ink">
                  {formatPlanPrice(currentCost, m.currency)}
                  <span className="text-sm font-normal text-ink/40">/mo</span>
                </p>
                <p className="mt-1 text-xs text-ink/45">
                  {count} {count === 1 ? "person" : "people"} · 9 hours a day
                </p>
              </div>
              <div className="rounded-2xl bg-black/[0.03] p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-ink/45">
                  Nudge AI Front Desk
                </p>
                <p className="mt-1 text-3xl font-bold tracking-tight text-ink">
                  {formatPlanPrice(nudge, m.currency)}
                  <span className="text-sm font-normal text-ink/40">/mo</span>
                </p>
                <p className="mt-1 text-xs text-ink/45">On WhatsApp 24×7 · set up for you</p>
              </div>
            </div>

            <div className="mt-3 grid gap-3 rounded-2xl bg-brand-50 p-5 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-brand-700/70">
                  Back in your pocket, monthly
                </p>
                <p className="text-3xl font-bold tracking-tight text-brand-700">
                  {formatPlanPrice(monthlySaving, m.currency)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-brand-700/70">
                  Over a year
                </p>
                <p className="text-3xl font-bold tracking-tight text-brand-700">
                  {formatPlanPrice(annualSaving, m.currency)}
                </p>
              </div>
            </div>
            <p className="mt-4 text-center text-xs text-ink/40">
              Conservative estimate. Nudge price is the AI Front Desk plan;
              WhatsApp per-message fees are billed by Meta separately.
            </p>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}
