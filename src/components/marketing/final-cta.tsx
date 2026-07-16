import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Container } from "./section";
import { ButtonLink } from "./button";
import { LeadForm } from "./lead-form";
import { Reveal } from "./motion-primitives";

const POINTS = [
  "Free plan — no credit card",
  "Official WhatsApp Cloud API",
  "Live the same day",
  "Cancel anytime",
];

/** The closer — light, direct, form in reach. No gimmicks: the page has
 * already shown the shift; this just asks for the hire. */
export function FinalCTA() {
  return (
    <section
      id="get-started"
      className="relative scroll-mt-24 overflow-hidden border-t border-ink/10 bg-white py-24 sm:py-28"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-[radial-gradient(760px_circle_at_50%_-10%,rgba(6,193,103,0.07),transparent_70%)]"
      />
      <Container className="relative">
        <Reveal className="mx-auto max-w-3xl text-center">
          <h2 className="serif-display text-balance text-[2.4rem] leading-[1.08] text-ink sm:text-[3.4rem]">
            Your front desk can start tonight.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[16.5px] leading-relaxed text-ink/55">
            Start free and try the whole product today — or book a setup call
            and we&rsquo;ll stand up your AI Front Desk with you, live on the
            call.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <ButtonLink href="/login" variant="primary" size="lg">
              Start free
              <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
            </ButtonLink>
            <ButtonLink href="/waitlist" variant="secondary" size="lg">
              Book a demo
            </ButtonLink>
          </div>
          <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {POINTS.map((p) => (
              <li
                key={p}
                className="flex items-center gap-1.5 text-[13.5px] text-ink/55"
              >
                <CheckCircle2 className="h-4 w-4 text-brand-600" aria-hidden />
                {p}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={0.1} className="mx-auto mt-14 max-w-xl">
          <LeadForm surface="home" defaultIntent="demo" />
        </Reveal>
      </Container>
    </section>
  );
}
