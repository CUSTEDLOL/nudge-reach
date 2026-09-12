"use client";

import { useState } from "react";
import { Check, PhoneCall, Sparkles } from "lucide-react";
import { Container, Section } from "./section";
import { LaunchDemoButton } from "./launch-cta";
import {
  PLAN_PRICES,
  planPriceYearly,
  planPriceYearlyPerMonth,
  publicPlans,
  type Plan,
} from "@/modules/billing/plans";
import {
  COUNTRY_PRESETS,
  formatPlanPrice,
  type Currency,
} from "@/modules/billing/money";

/**
 * Four tiers plus Enterprise, with a market picker and a monthly/yearly
 * switch. Prices and feature lists come from `modules/billing/plans` so the
 * public page and what checkout actually charges cannot drift apart.
 *
 * Two things here are provisional and are labelled as such on the page: the
 * yearly discount (no annual rate has been approved) and Entry's price
 * outside India (undecided in the founder record, so it reads "on request"
 * rather than inventing a number).
 *
 * Deliberately absent: usage credits, which stay internal until real
 * workloads are measured.
 */

/** Real markets only — the onboarding list's "Other" catch-all isn't a country. */
const MARKETS = COUNTRY_PRESETS.filter((c) => c.code !== "OTHER");

/** Entry's price is approved for India alone. */
function entryPricedIn(currency: Currency) {
  return currency === "INR";
}

type Billing = "monthly" | "yearly";

const selectCls =
  "h-11 rounded-xl border-2 border-ink/70 bg-white px-4 font-mono text-[12px] font-bold uppercase tracking-[0.08em] text-ink shadow-[3px_3px_0_rgba(10,15,13,0.5)] outline-none focus-visible:ring-2 focus-visible:ring-ink/40";

export function Pricing() {
  const [country, setCountry] = useState("IN");
  const [billing, setBilling] = useState<Billing>("monthly");

  const market = MARKETS.find((m) => m.code === country) ?? MARKETS[0];
  const currency = market.currency;
  const yearly = billing === "yearly";

  const plans = publicPlans();
  const tiers = plans.filter((p) => !p.contactOnly);
  const enterprise = plans.find((p) => p.contactOnly);

  function headline(plan: Plan) {
    if (plan.id === "entry" && !entryPricedIn(currency)) return null;
    const major = yearly
      ? planPriceYearlyPerMonth(plan, currency)
      : PLAN_PRICES[plan.id][currency];
    return formatPlanPrice(major, currency);
  }

  function subline(plan: Plan) {
    if (plan.id === "entry" && !entryPricedIn(currency)) {
      return "Ask us on the call";
    }
    if (!yearly) return "Billed monthly · excl. tax";
    return `${formatPlanPrice(planPriceYearly(plan, currency), currency)} billed yearly · excl. tax`;
  }

  return (
    <Section id="pricing" className="bg-[#f8fbf1]">
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block -rotate-2 rounded-full border-2 border-ink/70 bg-white px-4 py-1.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink shadow-[3px_3px_0_rgba(10,15,13,0.82)]">
            Simple pricing · No setup fee
          </span>
          <h1 className="mt-6 font-display text-[2.2rem] font-black uppercase leading-[0.96] tracking-[-0.035em] text-ink sm:text-[3.4rem]">
            Hire the front desk.
            <br />
            <span className="text-ink/38">Not the software.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[16px] leading-relaxed text-ink/60">
            Entry answers questions. Starter runs your whole workspace. Growth
            lets the AI act — booking into your calendar, collecting deposits
            and chasing the leads that go quiet.
          </p>
        </div>

        {/* market + billing controls */}
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <label className="flex items-center gap-2.5">
            <span className="font-mono text-[10.5px] font-black uppercase tracking-[0.14em] text-ink/55">
              Country
            </span>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className={selectCls}
              aria-label="Choose your country"
            >
              {MARKETS.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.label} · {m.currency}
                </option>
              ))}
            </select>
          </label>

          <div
            role="radiogroup"
            aria-label="Billing period"
            className="inline-flex items-center gap-1 rounded-xl border-2 border-ink/70 bg-white p-1 shadow-[3px_3px_0_rgba(10,15,13,0.5)]"
          >
            {(
              [
                ["monthly", "Monthly"],
                ["yearly", "Yearly"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={billing === value}
                onClick={() => setBilling(value)}
                className={
                  billing === value
                    ? "inline-flex h-9 items-center gap-2 rounded-lg bg-ink px-4 font-mono text-[11px] font-black uppercase tracking-[0.1em] text-white"
                    : "inline-flex h-9 items-center gap-2 rounded-lg px-4 font-mono text-[11px] font-black uppercase tracking-[0.1em] text-ink/55 hover:text-ink"
                }
              >
                {label}
                {value === "yearly" && (
                  <span
                    className={
                      billing === "yearly"
                        ? "rounded-full bg-[#ffd94a] px-1.5 py-0.5 text-[9px] text-ink"
                        : "rounded-full bg-ink/10 px-1.5 py-0.5 text-[9px] text-ink/70"
                    }
                  >
                    2 months free
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-10 grid max-w-6xl gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {tiers.map((plan) => {
            const featured = plan.highlighted === true;
            const price = headline(plan);
            return (
              <article
                key={plan.id}
                className={
                  featured
                    ? "relative flex flex-col overflow-hidden rounded-[1.5rem] border-2 border-ink/70 p-6 shadow-[9px_9px_0_rgba(10,15,13,0.82)] sm:p-7"
                    : "relative flex flex-col overflow-hidden rounded-[1.5rem] border-2 border-ink/70 bg-white p-6 shadow-[6px_6px_0_rgba(10,15,13,0.55)] sm:p-7"
                }
                style={
                  featured
                    ? {
                        background:
                          "linear-gradient(135deg, #54e58b 0%, #8eec72 48%, #c9f34f 100%)",
                      }
                    : undefined
                }
              >
                {featured ? (
                  <span className="mb-3 inline-flex w-fit -rotate-2 items-center gap-1.5 rounded-full border-2 border-ink/70 bg-[#ffd94a] px-3 py-1 font-mono text-[9.5px] font-black uppercase tracking-[0.12em] text-ink shadow-[2px_2px_0_rgba(10,15,13,0.5)]">
                    <Sparkles className="h-3 w-3" aria-hidden />
                    Most chosen
                  </span>
                ) : (
                  <span aria-hidden className="mb-3 block h-[26px]" />
                )}

                <h2 className="font-display text-[1.5rem] font-black uppercase leading-none tracking-[-0.03em] text-ink">
                  {plan.name}
                </h2>
                <p className="mt-2 min-h-[2.6rem] max-w-[24ch] text-[13.5px] font-semibold leading-snug text-ink/70">
                  {plan.tagline}
                </p>

                <div className="mt-5 min-h-[4.2rem]">
                  {price ? (
                    <div className="flex items-end gap-1.5">
                      <span className="font-display text-[2.3rem] font-black leading-none tracking-[-0.03em] text-ink">
                        {price}
                      </span>
                      <span className="pb-1 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-ink/55">
                        / month
                      </span>
                    </div>
                  ) : (
                    <span className="font-display text-[1.9rem] font-black leading-none tracking-[-0.03em] text-ink/70">
                      On request
                    </span>
                  )}
                  <p className="mt-1.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink/45">
                    {subline(plan)}
                  </p>
                </div>

                <LaunchDemoButton
                  className={
                    featured
                      ? "mt-5 inline-flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-ink/80 bg-[#ffd94a] px-6 text-[13px] font-black uppercase tracking-[0.08em] text-ink shadow-[0_4px_0_rgba(10,15,13,0.8)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#ffe37a] hover:shadow-[0_6px_0_rgba(10,15,13,0.8)] active:translate-y-0 active:shadow-[0_2px_0_rgba(10,15,13,0.8)]"
                      : "mt-5 inline-flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-ink/80 bg-white px-6 text-[13px] font-black uppercase tracking-[0.08em] text-ink shadow-[0_4px_0_rgba(10,15,13,0.5)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#f4f6f2] hover:shadow-[0_6px_0_rgba(10,15,13,0.5)] active:translate-y-0 active:shadow-[0_2px_0_rgba(10,15,13,0.5)]"
                  }
                >
                  <PhoneCall className="h-4 w-4" aria-hidden />
                  Book a Demo
                </LaunchDemoButton>

                <ul className="mt-6 grid gap-2.5 border-t-2 border-ink/15 pt-5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <span
                        className={
                          featured
                            ? "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 border-ink/70 bg-white text-ink"
                            : "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 border-ink/70 bg-[#ffd94a] text-ink"
                        }
                      >
                        <Check className="h-3 w-3" strokeWidth={3.5} />
                      </span>
                      <span className="text-[13px] font-semibold leading-snug text-ink/80">
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>

        {enterprise && (
          <article className="mx-auto mt-6 flex max-w-6xl flex-col gap-5 rounded-[1.5rem] border-2 border-ink/70 bg-ink px-6 py-7 shadow-[6px_6px_0_rgba(10,15,13,0.55)] sm:px-9 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-display text-[1.6rem] font-black uppercase leading-none tracking-[-0.03em] text-white">
                {enterprise.name}
              </h2>
              <p className="mt-2 max-w-xl text-[13.5px] font-semibold leading-relaxed text-white/70">
                {enterprise.tagline} Numbers, seats, call minutes and support
                agreed to your volume.
              </p>
            </div>
            <LaunchDemoButton className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl border-2 border-white/80 bg-transparent px-7 text-[13px] font-black uppercase tracking-[0.08em] text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:text-ink">
              <PhoneCall className="h-4 w-4" aria-hidden />
              Talk to us
            </LaunchDemoButton>
          </article>
        )}

        <p className="mx-auto mt-8 max-w-2xl text-center font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-ink/45">
          7-day trial, no card · Official WhatsApp Cloud API · Meta&rsquo;s
          per-message charges pass through at cost
        </p>
      </Container>
    </Section>
  );
}
