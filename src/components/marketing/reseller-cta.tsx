import { ArrowRight, Handshake } from "lucide-react";
import { Container, Section } from "./section";
import { ButtonLink } from "./button";
import { Reveal } from "./motion-primitives";

/** The future distribution channel: agencies/freelancers white-labelling the
 *  AI Front Desk at recurring margin. */
export function ResellerCTA() {
  return (
    <Section id="partners" className="border-t border-ink/10 bg-white">
      <Container>
        <Reveal>
          <div className="bg-mesh relative overflow-hidden bg-brand-950 px-6 py-12 sm:px-12 sm:py-16">
            <div className="relative z-10 max-w-2xl">
              <div className="flex items-baseline gap-4 border-b border-white/10 pb-4">
                <span className="font-mono text-sm font-semibold text-brand-400">05</span>
                <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-brand-200/70">
                  <Handshake className="h-3.5 w-3.5" aria-hidden />
                  For agencies &amp; freelancers
                </span>
              </div>
              <h2 className="mt-8 font-display text-3xl font-bold leading-[1.05] tracking-[-0.02em] text-white sm:text-4xl">
                Your clients need the front desk. You own the relationship.
              </h2>
              <p className="mt-4 max-w-xl text-pretty text-lg leading-relaxed text-brand-100/80">
                White-label Nudge for your clients, keep{" "}
                <strong className="text-white">30–40% recurring margin</strong>,
                and let us handle the platform. One vertical, done deeply — then
                scale across your book.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <ButtonLink href="/waitlist?ref=partner" variant="primary-dark" size="lg">
                  Become a partner
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-1" />
                </ButtonLink>
                <ButtonLink href="#salary" variant="secondary-dark" size="lg">
                  See the economics
                </ButtonLink>
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}
