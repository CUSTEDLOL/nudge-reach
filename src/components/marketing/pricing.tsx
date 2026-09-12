import { Check, PhoneCall, Sparkles } from "lucide-react";
import { Container, Section } from "./section";
import { LaunchDemoButton } from "./launch-cta";
import { PLAN_PRICES, publicPlans, type Plan } from "@/modules/billing/plans";

/**
 * Four tiers plus Enterprise. Prices and feature lists come from
 * `modules/billing/plans` so the public page and what the app actually
 * enforces can never drift apart. India is the headline currency; Singapore
 * is shown where it has been decided — Entry's has not, so Entry prints none.
 *
 * Deliberately absent: usage credits (internal until real workloads are
 * measured) and any setup fee (removed with the tiered pricing).
 */

const inr = new Intl.NumberFormat("en-IN");

function priceLine(plan: Plan) {
  return {
    inr: `₹${inr.format(PLAN_PRICES[plan.id].INR)}`,
    // Entry's Singapore price is undecided in the founder record; do not print
    // the derived placeholder as though it were a quote.
    sgd: plan.id === "entry" ? null : `S$${PLAN_PRICES[plan.id].SGD}`,
  };
}

export function Pricing() {
  const plans = publicPlans();
  const tiers = plans.filter((p) => !p.contactOnly);
  const enterprise = plans.find((p) => p.contactOnly);

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

        <div className="mx-auto mt-12 grid max-w-6xl gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {tiers.map((plan) => {
            const price = priceLine(plan);
            const featured = plan.highlighted === true;
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
                {featured && (
                  <span className="mb-3 inline-flex w-fit -rotate-2 items-center gap-1.5 rounded-full border-2 border-ink/70 bg-[#ffd94a] px-3 py-1 font-mono text-[9.5px] font-black uppercase tracking-[0.12em] text-ink shadow-[2px_2px_0_rgba(10,15,13,0.5)]">
                    <Sparkles className="h-3 w-3" aria-hidden />
                    Most chosen
                  </span>
                )}

                {!featured && <span aria-hidden className="mb-3 block h-[26px]" />}
                <h2 className="font-display text-[1.5rem] font-black uppercase leading-none tracking-[-0.03em] text-ink">
                  {plan.name}
                </h2>
                <p className="mt-2 min-h-[2.6rem] max-w-[24ch] text-[13.5px] font-semibold leading-snug text-ink/70">
                  {plan.tagline}
                </p>

                <div className="mt-5">
                  <div className="flex items-end gap-1.5">
                    <span className="font-display text-[2.3rem] font-black leading-none tracking-[-0.03em] text-ink">
                      {price.inr}
                    </span>
                    <span className="pb-1 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-ink/55">
                      / month
                    </span>
                  </div>
                  <p className="mt-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-ink/45">
                    {price.sgd ? `Singapore ${price.sgd} · ` : ""}excl. tax
                  </p>
                </div>

                <LaunchDemoButton
                  className={
                    featured
                      ? "mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-ink/80 bg-[#ffd94a] px-6 text-[13px] font-black uppercase tracking-[0.08em] text-ink shadow-[0_4px_0_rgba(10,15,13,0.8)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#ffe37a] hover:shadow-[0_6px_0_rgba(10,15,13,0.8)] active:translate-y-0 active:shadow-[0_2px_0_rgba(10,15,13,0.8)]"
                      : "mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-ink/80 bg-white px-6 text-[13px] font-black uppercase tracking-[0.08em] text-ink shadow-[0_4px_0_rgba(10,15,13,0.5)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#f4f6f2] hover:shadow-[0_6px_0_rgba(10,15,13,0.5)] active:translate-y-0 active:shadow-[0_2px_0_rgba(10,15,13,0.5)]"
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
