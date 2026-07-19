import { Container, Section } from "./section";
import { PricingTiers } from "./pricing-tiers";

export function Pricing() {
  return (
    <Section id="pricing" className="bg-[#f8fbf1]">
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block -rotate-2 rounded-full border-2 border-ink/70 bg-white px-4 py-1.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink shadow-[3px_3px_0_rgba(10,15,13,0.82)]">
            Simple pricing · Cancel anytime
          </span>
          <h1 className="mt-6 font-display text-[2.2rem] font-black uppercase leading-[0.96] tracking-[-0.035em] text-ink sm:text-[3.4rem]">
            One employee.
            <br />
            <span className="text-ink/38">A third of the salary.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[16px] leading-relaxed text-ink/60">
            The AI Front Desk runs your WhatsApp for you. Or start free with the
            self-serve tools and upgrade the day you hit a limit. Meta&rsquo;s
            per-message charges pass through at cost — no markup, ever.
          </p>
        </div>
        {/* Tier grid + ROI calculator share one ₹/$ toggle (client component). */}
        <PricingTiers />
      </Container>
    </Section>
  );
}
