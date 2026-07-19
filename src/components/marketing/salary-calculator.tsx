"use client";

import { useState } from "react";
import { Container, Section } from "./section";
import { Reveal } from "./motion-primitives";
import { PLAN_PRICES } from "@/modules/billing/plans";
import { formatPlanPrice, type Currency } from "@/modules/billing/money";
import { cn } from "@/lib/cn";

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
    <Section id="salary" className="border-t-2 border-ink/10 bg-[#f1f7ec]">
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block rotate-1 rounded-full border-2 border-ink/70 bg-white px-4 py-1.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink shadow-[3px_3px_0_rgba(10,15,13,0.82)]">
            The salary math
          </span>
          <h2 className="mt-6 font-display text-[2rem] font-black uppercase leading-[0.96] tracking-[-0.035em] text-ink sm:text-[3rem]">
            Pay for the work.
            <br />
            <span className="text-ink/38">Not another salary.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[15.5px] leading-relaxed text-ink/60">
            Two numbers about your business today, and what changes the day the
            AI Front Desk clocks in.
          </p>
        </div>

        <Reveal className="mx-auto mt-12 max-w-5xl">
          <div className="overflow-hidden rounded-[1.75rem] border-2 border-ink/70 bg-white shadow-[9px_9px_0_rgba(10,15,13,0.82)]">
            <div className="grid lg:grid-cols-[1fr_1.1fr]">
              {/* ---------------- Inputs ---------------- */}
              <div className="p-6 sm:p-8">
                {/* market toggle */}
                <div className="flex flex-wrap gap-2">
                  {Object.entries(MARKETS).map(([key, v]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => pick(key as keyof typeof MARKETS)}
                      className={cn(
                        "rounded-full border-2 px-3 py-1.5 font-mono text-[10.5px] font-black uppercase tracking-[0.06em] transition-all duration-200",
                        market === key
                          ? "border-ink/70 bg-ink text-white shadow-[3px_3px_0_rgba(10,15,13,0.35)]"
                          : "border-ink/25 bg-white text-ink/60 hover:border-ink/50 hover:text-ink"
                      )}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>

                {/* input 1: headcount */}
                <div className="mt-8">
                  <div className="flex items-baseline justify-between">
                    <label
                      htmlFor="count-input"
                      className="font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-ink/55"
                    >
                      Front-desk employees you have
                    </label>
                    <span className="font-display text-2xl font-black tracking-tight text-ink">
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
                    className="mt-3 w-full accent-[#06c167]"
                    aria-label="Number of front-desk employees"
                  />
                </div>

                {/* input 2: salary each */}
                <div className="mt-6">
                  <div className="flex items-baseline justify-between">
                    <label
                      htmlFor="salary-input"
                      className="font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-ink/55"
                    >
                      What you pay each, monthly
                    </label>
                    <span className="font-display text-2xl font-black tracking-tight text-ink">
                      {formatPlanPrice(salary, m.currency)}
                      <span className="font-mono text-sm font-bold text-ink/40">/mo</span>
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
                    className="mt-3 w-full accent-[#06c167]"
                    aria-label="Monthly front-desk salary"
                  />
                </div>

                {/* the two columns being compared */}
                <div className="mt-8 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border-2 border-ink/25 bg-[#f8fbf1] p-4">
                    <p className="font-mono text-[9.5px] font-bold uppercase tracking-[0.12em] text-ink/50">
                      Your desk today
                    </p>
                    <p className="mt-2 font-display text-[1.5rem] font-black leading-none tracking-[-0.02em] text-ink">
                      {formatPlanPrice(currentCost, m.currency)}
                    </p>
                    <p className="mt-1.5 text-[11.5px] font-medium text-ink/50">
                      {count} {count === 1 ? "person" : "people"} · 9h/day
                    </p>
                  </div>
                  <div
                    className="rounded-2xl border-2 border-ink/70 p-4"
                    style={{
                      background:
                        "linear-gradient(145deg, #7ee2a8 0%, #b8f09a 100%)",
                    }}
                  >
                    <p className="font-mono text-[9.5px] font-black uppercase tracking-[0.12em] text-ink/70">
                      AI Front Desk
                    </p>
                    <p className="mt-2 font-display text-[1.5rem] font-black leading-none tracking-[-0.02em] text-ink">
                      {formatPlanPrice(nudge, m.currency)}
                    </p>
                    <p className="mt-1.5 text-[11.5px] font-semibold text-ink/60">
                      24×7 · set up for you
                    </p>
                  </div>
                </div>
              </div>

              {/* ---------------- The saving ---------------- */}
              <div className="relative overflow-hidden border-t-2 border-ink/70 bg-[#0c1f16] p-6 sm:p-8 lg:flex lg:flex-col lg:justify-center lg:border-l-2 lg:border-t-0">
                <span
                  aria-hidden
                  className="pointer-events-none absolute -bottom-8 right-0 select-none font-display text-[9rem] font-black leading-none text-white/[0.06]"
                >
                  12×
                </span>

                <div className="relative">
                  <p className="font-mono text-[10.5px] font-black uppercase tracking-[0.18em] text-[#ffd94a]">
                    Back in your pocket
                  </p>
                  <p className="mt-3 font-display text-[2.8rem] font-black leading-none tracking-[-0.03em] text-white sm:text-[3.6rem]">
                    {formatPlanPrice(monthlySaving, m.currency)}
                    <span className="ml-1.5 font-mono text-lg font-bold text-white/40">
                      /mo
                    </span>
                  </p>
                  <p className="mt-5 border-t border-white/10 pt-4 text-sm leading-relaxed text-white/65">
                    {formatPlanPrice(annualSaving, m.currency)} over a year:{" "}
                    <span className="font-bold text-white">
                      every year it doesn&rsquo;t sleep.
                    </span>
                  </p>
                  <p className="mt-5 text-[11.5px] leading-relaxed text-white/40">
                    Conservative estimate. Nudge price is the AI Front Desk
                    plan; WhatsApp per-message fees are billed by Meta
                    separately.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}
