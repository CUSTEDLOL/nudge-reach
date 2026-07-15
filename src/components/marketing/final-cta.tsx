import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Container } from "./section";
import { ButtonLink } from "./button";
import { LeadForm } from "./lead-form";
import { Reveal, SpotlightCard } from "./motion-primitives";

const POINTS = [
  "Free plan — no credit card",
  "Official WhatsApp Cloud API",
  "Live the same day",
  "Cancel anytime",
];

export function FinalCTA() {
  return (
    <section
      id="get-started"
      className="relative scroll-mt-24 overflow-hidden bg-[#07261c] py-24 sm:py-28"
    >
      <Container className="relative">
        <Reveal className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-[2.2rem] font-black uppercase leading-[1.05] tracking-[-0.02em] text-white sm:text-[3.1rem]">
            Your customers are
            <span className="serif-display mt-3 block text-[1.8rem] normal-case tracking-normal text-brand-300 sm:text-[2.5rem]">
              already on WhatsApp.
            </span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-[16px] leading-relaxed text-white/65">
            Start free and try the whole product today — or book a setup call
            and we&rsquo;ll stand up your AI Front Desk with you, live on the
            call.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <ButtonLink href="/login" variant="primary" size="lg">
              Start free
              <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
            </ButtonLink>
            <ButtonLink href="/waitlist" variant="secondary-dark" size="lg">
              Book a demo
            </ButtonLink>
          </div>
          <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {POINTS.map((p) => (
              <li
                key={p}
                className="flex items-center gap-1.5 text-[13.5px] text-white/60"
              >
                <CheckCircle2 className="h-4 w-4 text-brand-400" aria-hidden />
                {p}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={0.1} className="mx-auto mt-14 max-w-xl">
          <SpotlightCard
            className="rounded-3xl"
            spotlight="rgba(6,193,103,0.14)"
          >
            <LeadForm surface="home" defaultIntent="demo" />
          </SpotlightCard>
        </Reveal>
      </Container>
    </section>
  );
}
