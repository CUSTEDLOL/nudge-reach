"use client";

import { useState } from "react";
import { motion } from "motion/react";
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

  const nudge = PLAN_PRICES.front_desk[m.currency];
  const monthlySaving = Math.max(0, salary - nudge);
  const annualSaving = monthlySaving * 12;
  const nudgePct = Math.min(100, Math.round((nudge / salary) * 100));

  function pick(key: keyof typeof MARKETS) {
    setMarket(key);
    setSalary(MARKETS[key].defaultSalary);
  }

  return (
    <Section id="salary" className="bg-cream">
      <Container>
        <SectionHeading
          eyebrow="The salary math"
          title="A front-desk hire, for a third of the cost."
          subtitle="It never calls in sick, never sleeps, and answers in seconds — every hour of every day."
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

            {/* salary slider */}
            <div className="mt-7">
              <div className="flex items-baseline justify-between">
                <label htmlFor="salary-input" className="text-sm font-medium text-ink/70">
                  A front-desk employee near you
                </label>
                <span className="font-display text-2xl text-ink">
                  {formatPlanPrice(salary, m.currency)}
                  <span className="text-sm text-ink/40">/mo</span>
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

            {/* comparison bars */}
            <div className="mt-8 space-y-4">
              <Bar
                label="Human front desk"
                value={formatPlanPrice(salary, m.currency)}
                pct={100}
                tone="muted"
              />
              <Bar
                label="Nudge AI Front Desk"
                value={`${formatPlanPrice(nudge, m.currency)}/mo`}
                pct={nudgePct}
                tone="brand"
              />
            </div>

            {/* result */}
            <div className="mt-8 grid gap-4 rounded-2xl bg-brand-50 p-5 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-brand-700/70">
                  You save every month
                </p>
                <p className="font-display text-3xl text-brand-700">
                  {formatPlanPrice(monthlySaving, m.currency)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-brand-700/70">
                  That&rsquo;s a year
                </p>
                <p className="font-display text-3xl text-brand-700">
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

function Bar({
  label,
  value,
  pct,
  tone,
}: {
  label: string;
  value: string;
  pct: number;
  tone: "muted" | "brand";
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="font-medium text-ink/70">{label}</span>
        <span className={tone === "brand" ? "font-semibold text-brand-700" : "text-ink/50"}>
          {value}
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-black/5">
        <motion.div
          className={`h-full rounded-full ${
            tone === "brand" ? "bg-brand-500" : "bg-neutral-300"
          }`}
          initial={{ width: 0 }}
          whileInView={{ width: `${pct}%` }}
          viewport={{ once: false }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
}
