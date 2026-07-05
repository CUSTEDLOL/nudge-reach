import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Container } from "./section";
import { ButtonLink } from "./button";
import { LeadForm } from "./lead-form";
import { Reveal } from "./motion-primitives";

const POINTS = [
  "Free plan — no credit card, no expiry",
  "Official WhatsApp Cloud API, opt-in enforced",
  "Most teams are live the same day",
  "Cancel anytime — your data stays yours",
];

export function FinalCTA() {
  return (
    <section
      id="get-started"
      className="bg-mesh relative scroll-mt-24 overflow-hidden bg-brand-950 py-24 sm:py-28"
    >
      <div className="bg-linegrid pointer-events-none absolute inset-0 opacity-40" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-80 w-[40rem] -translate-x-1/2 rounded-full bg-brand-500/20 blur-[120px]" />

      <Container className="relative z-10">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-[13px] font-semibold text-brand-200">
                Get started
              </span>
            </Reveal>
            <Reveal delay={0.05}>
              <h2 className="mt-5 text-balance text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:text-5xl">
                Turn WhatsApp into your{" "}
                <span className="font-display text-gradient italic">
                  growth engine
                </span>
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-brand-100/70">
                Start free and try the whole product today — or book a setup call
                and we&apos;ll stand up your AI Front Desk with you, live on the
                call.
              </p>
            </Reveal>

            <Reveal delay={0.15}>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <ButtonLink href="/login" variant="primary-dark" size="lg">
                  Start free
                  <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
                </ButtonLink>
                <ButtonLink href="/waitlist" variant="secondary-dark" size="lg">
                  Book a demo
                </ButtonLink>
              </div>
            </Reveal>

            <Reveal delay={0.2}>
              <ul className="mt-9 grid gap-3 sm:grid-cols-2">
                {POINTS.map((p) => (
                  <li key={p} className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-400" />
                    <span className="text-[14.5px] leading-snug text-brand-100/85">
                      {p}
                    </span>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>

          <Reveal delay={0.2}>
            <LeadForm surface="home" defaultIntent="demo" />
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
