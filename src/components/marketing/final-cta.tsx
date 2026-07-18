import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Container } from "./section";
import { ButtonLink } from "./button";
import { BookDemoButton } from "./book-demo";
import { LeadForm } from "./lead-form";
import { Reveal } from "./motion-primitives";

const POINTS = [
  "Free plan — no credit card",
  "Official WhatsApp Cloud API",
  "Live the same day",
  "Cancel anytime",
];

/** The closer — the page ends where it began: back in the park. The loop
 * plays behind a white legibility wash; the ask sits on top. */
export function FinalCTA() {
  return (
    <section
      id="get-started"
      className="relative scroll-mt-24 overflow-hidden border-t border-ink/10 bg-[#eaf3ee] py-24 sm:py-28"
    >
      <video
        autoPlay
        muted
        loop
        playsInline
        poster="/hero/park-cta-v2.jpg"
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover"
      >
        <source src="/hero/park-cta-v2.mp4" type="video/mp4" />
      </video>
      {/* legibility grade: airy wash for the ink copy, clear lower ground */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.94) 0%, rgba(255,255,255,0.82) 34%, rgba(255,255,255,0.55) 62%, rgba(255,255,255,0.25) 100%)",
        }}
      />
      <Container className="relative">
        <Reveal className="mx-auto max-w-3xl text-center">
          <h2 className="serif-display text-balance text-[2.4rem] leading-[1.08] text-ink sm:text-[3.4rem]">
            Your front desk can start tonight.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[16.5px] leading-relaxed text-ink/55">
            The Easiest WhatsApp Agent You&rsquo;ve Ever Used.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <ButtonLink href="/login" variant="primary" size="lg">
              Start free
              <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
            </ButtonLink>
            <BookDemoButton variant="secondary" size="lg">
              Book a Demo
            </BookDemoButton>
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
