import { Check, Minus } from "lucide-react";
import { Container, Section, SectionHeading } from "./section";
import { Reveal } from "./motion-primitives";

/**
 * The comparison that makes the case: respectful, factual, devastating. Meta's
 * free Business AI (launched June 2026) answers questions — but it's inbound-only
 * and can't act in your real systems. That's the whole moat.
 */
const ROWS: { label: string; meta: boolean; nudge: boolean }[] = [
  { label: "Answers customer questions on WhatsApp", meta: true, nudge: true },
  { label: "Recommends products & qualifies leads", meta: true, nudge: true },
  { label: "Books into YOUR real Google Calendar", meta: false, nudge: true },
  { label: "Chases leads that go quiet", meta: false, nudge: true },
  { label: "Booking reminders + no-show recovery", meta: false, nudge: true },
  { label: "Re-engages after the 24-hour window", meta: false, nudge: true },
  { label: "Sends payment links", meta: false, nudge: true },
  { label: "Set up & run for you by humans", meta: false, nudge: true },
];

function Cell({ on }: { on: boolean }) {
  return on ? (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 text-white">
      <Check className="h-4 w-4" aria-hidden />
    </span>
  ) : (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-neutral-200 text-neutral-400">
      <Minus className="h-4 w-4" aria-hidden />
    </span>
  );
}

export function MetaVsNudge() {
  return (
    <Section id="compare" className="bg-white">
      <Container>
        <SectionHeading
          eyebrow="Meta Business AI vs. Nudge"
          title="“AI that replies” is now free. Running the business isn't."
          subtitle="Meta's free agent answers questions from your Facebook page. Nudge's AI Front Desk acts in your real systems — and we set it all up."
        />

        <Reveal className="mt-12">
          <div className="overflow-x-auto">
            <div className="mx-auto min-w-[520px] max-w-3xl overflow-hidden rounded-3xl border border-black/10 bg-cream shadow-soft">
              {/* header row */}
              <div className="grid grid-cols-[1fr_7rem_7rem] items-stretch">
                <div className="px-5 py-4" />
                <div className="flex flex-col items-center justify-center border-l border-black/5 px-2 py-4 text-center">
                  <span className="text-sm font-semibold text-ink/70">
                    Meta&rsquo;s free AI
                  </span>
                  <span className="text-[11px] text-ink/40">Inbound only</span>
                </div>
                <div className="flex flex-col items-center justify-center bg-brand-500 px-2 py-4 text-center">
                  <span className="text-sm font-bold text-white">
                    Nudge Front Desk
                  </span>
                  <span className="text-[11px] text-brand-50/80">
                    Books · chases · collects
                  </span>
                </div>
              </div>

              {ROWS.map((row, i) => (
                <div
                  key={row.label}
                  className={`grid grid-cols-[1fr_7rem_7rem] items-center ${
                    i % 2 ? "bg-black/[0.015]" : ""
                  }`}
                >
                  <div className="px-5 py-3.5 text-sm font-medium text-ink/80">
                    {row.label}
                  </div>
                  <div className="flex justify-center border-l border-black/5 py-3.5">
                    <Cell on={row.meta} />
                  </div>
                  <div className="flex justify-center bg-brand-500/[0.06] py-3.5">
                    <Cell on={row.nudge} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p className="mx-auto mt-5 max-w-xl text-center text-sm text-ink/50">
            Meta Business AI, launched June 2026, is genuinely good at answering.
            Everything below the line is what turns answers into revenue — and
            it&rsquo;s why an AI Front Desk isn&rsquo;t software, it&rsquo;s an
            employee.
          </p>
        </Reveal>
      </Container>
    </Section>
  );
}
