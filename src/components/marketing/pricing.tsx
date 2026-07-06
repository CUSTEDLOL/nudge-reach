import { Container, Section, SectionHeading } from "./section";
import { PricingTiers } from "./pricing-tiers";

export function Pricing() {
  return (
    <Section id="pricing" className="bg-white">
      <Container>
        <SectionHeading
          eyebrow="Simple, transparent pricing"
          title={
            <>
              Priced for shops, <span className="text-gradient">not enterprises</span>
            </>
          }
          subtitle="Start free and upgrade inside the app the day you hit a limit. Meta's per-conversation charges are passed through at cost — shown clearly before every send."
        />
        {/* Tier grid + ROI calculator share one ₹/$ toggle (client component). */}
        <PricingTiers />
      </Container>
    </Section>
  );
}
