import { Check, X } from "lucide-react";
import { Container, Section, SectionHeading } from "./section";
import { Reveal } from "./motion-primitives";

/**
 * The comparison that makes the case: respectful, factual, devastating.
 * Everyone can answer a WhatsApp message now. The columns diverge on who
 * actually RUNS the shop.
 */
const COLUMNS: { name: string; sub: string }[] = [
  { name: "Meta AI", sub: "Free" },
  { name: "AiSensy", sub: "CRM tool" },
  { name: "WATI", sub: "CRM tool" },
  { name: "Interakt", sub: "CRM tool" },
  { name: "Human hire", sub: "9 hours" },
];

const ROWS: { label: string; marks: [boolean, boolean, boolean, boolean, boolean] }[] = [
  { label: "Answers on WhatsApp, 24×7", marks: [true, true, true, true, false] },
  { label: "Books into your real calendar", marks: [false, false, false, false, true] },
  { label: "Chases quiet leads on its own", marks: [false, false, false, false, false] },
  { label: "Re-engages after the 24-hour window", marks: [false, true, true, true, false] },
  { label: "Collects payments & deposits", marks: [false, false, false, false, true] },
  { label: "Works while you sleep", marks: [true, false, false, false, false] },
  { label: "Set up and run FOR you", marks: [false, false, false, false, false] },
];

function Cell({ on }: { on: boolean }) {
  return on ? (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 text-white">
      <Check className="h-4 w-4" aria-hidden />
      <span className="sr-only">Yes</span>
    </span>
  ) : (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-neutral-200 text-neutral-400">
      <X className="h-4 w-4" aria-hidden />
      <span className="sr-only">No</span>
    </span>
  );
}

const GRID = "grid grid-cols-[minmax(12rem,1.4fr)_repeat(5,minmax(5.5rem,1fr))_minmax(7rem,1.1fr)]";

export function MetaVsNudge() {
  return (
    <Section id="compare" className="bg-white">
      <Container>
        <SectionHeading
          eyebrow="The honest comparison"
          title="Everyone answers. One of them runs the shop."
          subtitle="Meta's free AI replies to questions. The CRM tools give you software to operate yourself. A hire works nine hours. The AI Front Desk does the whole job."
        />

        <Reveal className="mt-12">
          <div className="overflow-x-auto">
            <div className="mx-auto min-w-[860px] max-w-6xl overflow-hidden rounded-3xl border border-black/10 bg-cream shadow-soft">
              {/* header row */}
              <div className={`${GRID} items-stretch`}>
                <div className="px-5 py-4" />
                {COLUMNS.map((col) => (
                  <div
                    key={col.name}
                    className="flex flex-col items-center justify-center border-l border-black/5 px-2 py-4 text-center"
                  >
                    <span className="text-sm font-semibold text-ink/70">{col.name}</span>
                    <span className="text-[11px] text-ink/40">{col.sub}</span>
                  </div>
                ))}
                <div className="flex flex-col items-center justify-center bg-brand-500 px-2 py-4 text-center">
                  <span className="text-sm font-bold text-white">Nudge</span>
                  <span className="text-[11px] text-brand-50/80">AI Front Desk</span>
                </div>
              </div>

              {ROWS.map((row, i) => (
                <div
                  key={row.label}
                  className={`${GRID} items-center ${i % 2 ? "bg-black/[0.015]" : ""}`}
                >
                  <div className="px-5 py-3.5 text-sm font-medium text-ink/80">
                    {row.label}
                  </div>
                  {row.marks.map((on, j) => (
                    <div
                      key={j}
                      className="flex justify-center border-l border-black/5 py-3.5"
                    >
                      <Cell on={on} />
                    </div>
                  ))}
                  <div className="flex justify-center bg-brand-500/[0.06] py-3.5">
                    <Cell on={true} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p className="mx-auto mt-5 max-w-2xl text-center text-sm text-ink/50">
            The tools are good software — if you have someone to run them. The
            AI Front Desk is the someone: trained on your business, on shift
            around the clock, set up for you.
          </p>
        </Reveal>
      </Container>
    </Section>
  );
}
