import { ArrowRight } from "lucide-react";
import { Container, Section } from "./section";
import { ButtonLink } from "./button";
import { Reveal } from "./motion-primitives";

/** The future distribution channel: agencies/freelancers white-labelling the
 *  AI Front Desk at recurring margin. Quiet, centered, one idea. */
export function ResellerCTA() {
  return (
    <Section id="partners" className="border-y border-black/[0.05] bg-[#fafbfa]">
      <Container>
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="text-[11.5px] font-bold uppercase tracking-[0.18em] text-ink/40">
            For agencies &amp; freelancers
          </span>
          <h2 className="mt-4 font-display text-[1.9rem] font-black leading-[1.08] tracking-[-0.02em] text-ink sm:text-[2.4rem]">
            Sell the AI Front Desk{" "}
            <span className="serif-display">under your own brand.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[16px] leading-relaxed text-ink/55">
            White-label Nudge for your clients, keep{" "}
            <strong className="font-bold text-ink">30–40% recurring margin</strong>,
            and let us handle the platform.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <ButtonLink href="/waitlist?ref=partner" variant="secondary">
              Become a partner
              <ArrowRight className="h-4 w-4" />
            </ButtonLink>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}
