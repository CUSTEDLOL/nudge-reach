import { ArrowRight, Handshake } from "lucide-react";
import { Container, Section } from "./section";
import { ButtonLink } from "./button";
import { Reveal } from "./motion-primitives";

/** The future distribution channel: agencies/freelancers white-labelling the
 *  AI Front Desk at recurring margin. */
export function ResellerCTA() {
  return (
    <Section id="partners" className="bg-cream">
      <Container>
        <Reveal>
          <div className="bg-mesh relative overflow-hidden rounded-3xl bg-brand-950 px-6 py-12 text-center sm:px-12 sm:py-16">
            <div className="relative z-10 mx-auto max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-[13px] font-semibold text-brand-200">
                <Handshake className="h-4 w-4" aria-hidden />
                For agencies &amp; freelancers
              </span>
              <h2 className="mt-5 font-display text-3xl text-white sm:text-4xl">
                Sell the AI Front Desk under your own brand.
              </h2>
              <p className="mt-4 text-pretty text-lg leading-relaxed text-brand-100/80">
                White-label Nudge for your clients, keep{" "}
                <strong className="text-white">30–40% recurring margin</strong>,
                and let us handle the platform. One vertical, done deeply — then
                scale across your book.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
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
