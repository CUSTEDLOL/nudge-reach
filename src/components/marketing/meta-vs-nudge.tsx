import { Check, Minus, X } from "lucide-react";
import { Container, Section, SectionHeading } from "./section";
import { Reveal } from "./motion-primitives";

/**
 * The comparison that makes the case: respectful, factual, devastating.
 * Everyone can answer a WhatsApp message now — Meta's free AI, the CRM
 * tools, a human hire. The columns diverge on who actually RUNS the shop.
 */
type Mark = "yes" | "no" | "half";

const COLUMNS: { name: string; sub: string }[] = [
  { name: "Meta AI", sub: "Free · inbound only" },
  { name: "WhatsApp CRMs", sub: "AiSensy · WATI · Interakt" },
  { name: "Human front desk", sub: "One person, 9 hours" },
];

const ROWS: {
  label: string;
  marks: [Mark, Mark, Mark];
  nudge: Mark;
}[] = [
  { label: "Answers on WhatsApp, 24×7", marks: ["yes", "half", "half"], nudge: "yes" },
  { label: "Books into your real calendar", marks: ["no", "half", "yes"], nudge: "yes" },
  { label: "Chases leads that go quiet", marks: ["no", "half", "half"], nudge: "yes" },
  { label: "Re-engages after the 24-hour window", marks: ["no", "half", "no"], nudge: "yes" },
  { label: "Collects payments & deposits", marks: ["no", "half", "yes"], nudge: "yes" },
  { label: "Set up and run FOR you", marks: ["no", "no", "no"], nudge: "yes" },
];

const COST: [string, string, string, string] = [
  "Free",
  "₹999–2,499 + your time",
  "₹18–25,000",
  "₹14,999",
];

function Cell({ mark }: { mark: Mark }) {
  if (mark === "yes")
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 text-white">
        <Check className="h-4 w-4" aria-hidden />
        <span className="sr-only">Yes</span>
      </span>
    );
  if (mark === "half")
    return (
      <span
        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-amber-600"
        title="Partly — you do the work yourself"
      >
        <Minus className="h-4 w-4" aria-hidden />
        <span className="sr-only">Partly, do-it-yourself</span>
      </span>
    );
  return (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-neutral-200 text-neutral-400">
      <X className="h-4 w-4" aria-hidden />
      <span className="sr-only">No</span>
    </span>
  );
}

const GRID = "grid grid-cols-[minmax(11rem,1fr)_6.5rem_8.5rem_7.5rem_8rem]";

export function MetaVsNudge() {
  return (
    <Section id="compare" className="bg-white">
      <Container>
        <SectionHeading
          eyebrow="The honest comparison"
          title="Everyone answers. One of them runs the shop."
          subtitle="Meta's free AI replies to questions. The CRM tools give you software to operate. A hire works nine hours. The AI Front Desk does the whole job — around the clock, set up for you."
        />

        <Reveal className="mt-12">
          <div className="overflow-x-auto">
            <div className="mx-auto min-w-[760px] max-w-5xl overflow-hidden rounded-3xl border border-black/10 bg-cream shadow-soft">
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
                  <span className="text-sm font-bold text-white">Nudge Front Desk</span>
                  <span className="text-[11px] text-brand-50/80">
                    Answers · books · chases · collects
                  </span>
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
                  {row.marks.map((mark, j) => (
                    <div
                      key={j}
                      className="flex justify-center border-l border-black/5 py-3.5"
                    >
                      <Cell mark={mark} />
                    </div>
                  ))}
                  <div className="flex justify-center bg-brand-500/[0.06] py-3.5">
                    <Cell mark={row.nudge} />
                  </div>
                </div>
              ))}

              {/* cost row */}
              <div className={`${GRID} items-center border-t border-black/10`}>
                <div className="px-5 py-4 text-sm font-bold text-ink">Monthly cost</div>
                {COST.slice(0, 3).map((c, j) => (
                  <div
                    key={j}
                    className="border-l border-black/5 px-2 py-4 text-center text-[13px] font-semibold text-ink/70"
                  >
                    {c}
                  </div>
                ))}
                <div className="bg-brand-500/[0.06] px-2 py-4 text-center text-[13px] font-bold text-brand-700">
                  {COST[3]}
                </div>
              </div>
            </div>
          </div>
          <p className="mx-auto mt-5 max-w-2xl text-center text-sm text-ink/50">
            The amber marks mean &ldquo;possible, if you build and run it
            yourself.&rdquo; That&rsquo;s the difference between buying software
            and hiring an employee: with tools, the missing ingredient is your
            time. Nudge&rsquo;s AI Front Desk comes set up, trained on your
            business, and on shift all night.
          </p>
        </Reveal>
      </Container>
    </Section>
  );
}
