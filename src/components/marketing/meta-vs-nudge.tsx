import { Check } from "lucide-react";
import { Container, Section } from "./section";
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
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-white">
      <Check className="h-3.5 w-3.5" aria-hidden />
      <span className="sr-only">Yes</span>
    </span>
  ) : (
    <span className="text-lg font-black leading-none text-ink/50" aria-hidden>
      —
    </span>
  );
}

const GRID = "grid grid-cols-[minmax(12rem,1.4fr)_repeat(5,minmax(5.5rem,1fr))_minmax(7rem,1.1fr)]";

export function MetaVsNudge() {
  return (
    <Section id="compare" className="border-t border-ink/10 bg-white">
      <Container>
        <Reveal className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-[2.1rem] font-black uppercase leading-[1.06] tracking-[-0.02em] text-ink sm:text-[2.9rem]">
            Answers are cheap.
            <span className="serif-display mt-3 block text-[1.7rem] normal-case tracking-normal text-ink/85 sm:text-[2.3rem]">
              Running the desk isn&rsquo;t.
            </span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-[16px] leading-relaxed text-ink/55">
            Meta&rsquo;s free AI <strong className="font-bold text-ink/85">replies to questions</strong>. The CRM tools give
            you software to <strong className="font-bold text-ink/85">operate yourself</strong>. A hire works nine hours.
            The AI Front Desk <strong className="font-bold text-ink/85">does the whole job</strong>.
          </p>
        </Reveal>

        <Reveal className="mt-12">
          <div className="overflow-x-auto">
            <div className="mx-auto min-w-[860px] max-w-6xl rounded-2xl border-2 border-ink/10 bg-white px-6 py-2 shadow-[10px_10px_0_#d3f8e0]">
              {/* header row — a ruled ledger, not a card */}
              <div className={`${GRID} items-stretch border-b border-ink/15`}>
                <div className="px-1 py-4" />
                {COLUMNS.map((col) => (
                  <div
                    key={col.name}
                    className="flex flex-col items-center justify-center px-2 py-4 text-center"
                  >
                    <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.08em] text-ink/60">
                      {col.name}
                    </span>
                    <span className="text-[11px] text-ink/35">{col.sub}</span>
                  </div>
                ))}
                <div className="flex flex-col items-center justify-center rounded-t-xl bg-brand-500 px-2 py-4 text-center">
                  <span className="font-mono text-[12px] font-bold uppercase tracking-[0.08em] text-white">
                    Nudge
                  </span>
                  <span className="text-[11px] text-brand-50/80">AI Front Desk</span>
                </div>
              </div>

              {ROWS.map((row, i) => (
                <div
                  key={row.label}
                  className={`${GRID} items-center border-b border-ink/[0.07] transition-colors duration-200 last:border-b-0 hover:bg-white/80`}
                >
                  <div className="py-3.5 pr-4 text-sm font-medium text-ink/80">
                    {row.label}
                  </div>
                  {row.marks.map((on, j) => (
                    <div key={j} className="flex justify-center py-3.5">
                      <Cell on={on} />
                    </div>
                  ))}
                  <div
                    className={`flex justify-center self-stretch bg-brand-50 py-3.5 ${
                      i === ROWS.length - 1 ? "rounded-b-xl" : ""
                    }`}
                  >
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
