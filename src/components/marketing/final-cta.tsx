import { Container } from "./section";
import { LeadForm } from "./lead-form";
import { Reveal } from "./motion-primitives";

/* ------------------------------------------------------------------ *
 * THE OFFER LETTER
 * The page ends the way a hire ends: you extend the offer. A paper
 * letter on the desk — terms filled in green ink, the lead form as the
 * employer's details, a seal instead of another gradient panel.
 * ------------------------------------------------------------------ */

const TERMS: [string, string][] = [
  ["Position", "AI Front Desk — runs your WhatsApp"],
  ["Working hours", "24 / 7 / 365, nights and festivals included"],
  ["Compensation", "from ₹14,999 / month — about a third of a human salary"],
  ["Sick days", "none. It does not get sick."],
  ["Probation", "cancel anytime — no lock-in, no notice period"],
];

export function FinalCTA() {
  return (
    <section
      id="get-started"
      className="relative scroll-mt-24 border-t border-ink/10 bg-[#f6f4ee] py-24 sm:py-28"
    >
      <Container>
        <Reveal className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 border border-ink/20 px-4 py-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.24em] text-ink/60">
            One document left
          </span>
          <h2 className="mt-7 font-display text-[2.2rem] font-black uppercase leading-[1.02] tracking-[-0.02em] text-ink sm:text-[3.1rem]">
            Extend the offer.
          </h2>
          <p className="serif-display mt-3 text-[1.4rem] text-ink/75 sm:text-[1.8rem]">
            Your new employee can start tonight.
          </p>
        </Reveal>

        {/* the letter */}
        <Reveal delay={0.08} className="mx-auto mt-14 max-w-2xl">
          <div className="relative rounded-sm border border-ink/10 bg-white px-7 py-10 shadow-[0_36px_70px_-40px_rgba(10,31,26,0.35)] sm:px-12">
            {/* letterhead */}
            <div className="flex items-baseline justify-between border-b border-ink/10 pb-5">
              <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.24em] text-ink/50">
                Offer of employment
              </p>
              <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink/35">
                Effective immediately
              </p>
            </div>

            {/* terms */}
            <dl className="mt-7 space-y-4">
              {TERMS.map(([k, v]) => (
                <div
                  key={k}
                  className="grid gap-1 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-6"
                >
                  <dt className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink/40 sm:pt-1">
                    {k}
                  </dt>
                  <dd className="serif-display text-[1.05rem] leading-snug text-ink sm:text-[1.15rem]">
                    {v}
                  </dd>
                </div>
              ))}
            </dl>

            {/* employer details = the form */}
            <div className="mt-9 border-t border-dashed border-ink/15 pt-8">
              <p className="mb-4 font-mono text-[10.5px] font-semibold uppercase tracking-[0.24em] text-ink/40">
                Employer details — we reply on WhatsApp within a day
              </p>
              <LeadForm surface="home" defaultIntent="demo" />
            </div>

            {/* signature row */}
            <div className="mt-9 flex items-end justify-between gap-6 border-t border-ink/10 pt-6">
              <div>
                <p className="serif-display text-[1.6rem] italic leading-none text-ink">
                  Nudge
                </p>
                <p className="mt-1.5 font-mono text-[9.5px] uppercase tracking-[0.2em] text-ink/40">
                  The AI Front Desk · accepts
                </p>
              </div>
              <div
                aria-hidden
                className="grid h-20 w-20 shrink-0 rotate-12 place-items-center rounded-full border-2 border-brand-600/60 text-center"
              >
                <span className="px-2 font-mono text-[7.5px] font-bold uppercase leading-[1.5] tracking-[0.16em] text-brand-700/80">
                  Official WhatsApp Cloud API
                </span>
              </div>
            </div>
          </div>

          <p className="mt-6 text-center text-[12.5px] text-ink/45">
            Free plan available · no credit card · live the same day · cancel
            anytime
          </p>
        </Reveal>
      </Container>
    </section>
  );
}
