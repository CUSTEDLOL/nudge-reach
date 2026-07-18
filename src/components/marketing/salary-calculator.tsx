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
    <Section id="salary" className="border-t border-ink/10 bg-white">
      <Container>
        <SectionHeading
          eyebrow="The salary math"
          title={
            <>
              Pay for the work. Not another salary.
            </>
          }
          subtitle="Two numbers about your business today, and what changes the day the AI Front Desk clocks in."
        />

        <Reveal className="mt-12">
          <div className="grid gap-10 border-t border-ink/15 pt-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
            <div>
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

            </div>

            {/* the ledger: today vs the hire that never sleeps */}
            <div className="flex flex-col">
              <div className="grid grid-cols-2">
                <div className="border-t border-ink/15 pt-4">
                  <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink/45">
                    Your front desk today
                  </p>
                  <p className="mt-2 font-display text-3xl font-bold tracking-[-0.02em] text-ink sm:text-4xl">
                    {formatPlanPrice(currentCost, m.currency)}
                    <span className="text-sm font-normal text-ink/40">/mo</span>
                  </p>
                  <p className="mt-1 text-xs text-ink/45">
                    {count} {count === 1 ? "person" : "people"} · 9 hours a day
                  </p>
                </div>
                <div className="border-t border-brand-500 pt-4 pl-6">
                  <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-brand-700">
                    Nudge AI Front Desk
                  </p>
                  <p className="mt-2 font-display text-3xl font-bold tracking-[-0.02em] text-ink sm:text-4xl">
                    {formatPlanPrice(nudge, m.currency)}
                    <span className="text-sm font-normal text-ink/40">/mo</span>
                  </p>
                  <p className="mt-1 text-xs text-ink/45">
                    On WhatsApp 24×7 · set up for you
                  </p>
                </div>
              </div>

              <div className="mt-8 flex-1 bg-brand-950 p-7 sm:p-8">
                <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-brand-300">
                  Back in your pocket
                </p>
                <p className="mt-3 font-display text-5xl font-bold tracking-[-0.03em] text-white sm:text-6xl">
                  {formatPlanPrice(monthlySaving, m.currency)}
                  <span className="text-lg font-normal text-white/40"> /mo</span>
                </p>
                <p className="mt-4 border-t border-white/10 pt-4 text-sm text-brand-100/70">
                  {formatPlanPrice(annualSaving, m.currency)} over a year:{" "}
                  <span className="font-bold text-white">every year it doesn&rsquo;t sleep.</span>
                </p>
              </div>
              <p className="mt-4 text-xs text-ink/40">
                Conservative estimate. Nudge price is the AI Front Desk plan;
                WhatsApp per-message fees are billed by Meta separately.
              </p>
            </div>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}
