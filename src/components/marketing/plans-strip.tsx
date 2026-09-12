import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Container, Section } from "./section";
import { PLAN_PRICES, selfServePlans } from "@/modules/billing/plans";

/**
 * Compact plan summary for the landing page. The full grid lives on
 * /pricing; this exists so a visitor who never clicks the nav still learns
 * what it costs and where the AI stops replying and starts acting.
 *
 * Prices and the headline capability per tier come from
 * `modules/billing/plans`, the same source the app enforces.
 */

const inr = new Intl.NumberFormat("en-IN");

/** The one thing each tier buys you that the tier below does not. */
const TURNING_POINT: Record<string, string> = {
  entry: "A chatbot that knows your business",
  starter: "It answers everyone, day and night",
  growth: "It books, collects and chases",
  pro: "It picks up the phone as well",
};

export function PlansStrip() {
  const tiers = selfServePlans();

  return (
    <Section id="plans" className="bg-[#f8fbf1]">
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block -rotate-2 rounded-full border-2 border-ink/70 bg-white px-4 py-1.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink shadow-[3px_3px_0_rgba(10,15,13,0.82)]">
            Four plans · No setup fee
          </span>
          <h2 className="mt-6 font-display text-[2rem] font-black uppercase leading-[0.96] tracking-[-0.035em] text-ink sm:text-[3rem]">
            A third of a salary.
            <br />
            <span className="text-ink/38">None of the sick days.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[15.5px] leading-relaxed text-ink/60">
            A receptionist in India costs ₹18,000 to ₹25,000 a month and works
            one shift. Every plan below works all of them.
          </p>
        </div>

        <div className="mx-auto mt-11 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tiers.map((plan) => {
            const featured = plan.highlighted === true;
            return (
              <div
                key={plan.id}
                className={
                  featured
                    ? "rounded-[1.25rem] border-2 border-ink/70 bg-[#c9f34f] p-5 shadow-[7px_7px_0_rgba(10,15,13,0.82)]"
                    : "rounded-[1.25rem] border-2 border-ink/70 bg-white p-5 shadow-[5px_5px_0_rgba(10,15,13,0.5)]"
                }
              >
                <p className="font-mono text-[10px] font-black uppercase tracking-[0.14em] text-ink/55">
                  {plan.name}
                </p>
                <div className="mt-2 flex items-end gap-1.5">
                  <span className="font-display text-[1.9rem] font-black leading-none tracking-[-0.03em] text-ink">
                    ₹{inr.format(PLAN_PRICES[plan.id].INR)}
                  </span>
                  <span className="pb-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink/50">
                    / mo
                  </span>
                </div>
                <p className="mt-3 flex items-start gap-2 text-[13.5px] font-bold leading-snug text-ink/85">
                  <span className="mt-0.5 grid h-4.5 w-4.5 shrink-0 place-items-center rounded border-2 border-ink/70 bg-[#ffd94a] text-ink">
                    <Check className="h-2.5 w-2.5" strokeWidth={4} />
                  </span>
                  {TURNING_POINT[plan.id] ?? plan.tagline}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-9 text-center">
          <Link
            href="/pricing"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-ink/80 bg-ink px-7 text-[13px] font-black uppercase tracking-[0.08em] text-white shadow-[0_4px_0_rgba(10,15,13,0.45)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_0_rgba(10,15,13,0.45)] active:translate-y-0 active:shadow-[0_2px_0_rgba(10,15,13,0.45)]"
          >
            See what each plan includes
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <p className="mt-3 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-ink/45">
            7-day trial after your demo · Enterprise scoped with you
          </p>
        </div>
      </Container>
    </Section>
  );
}
