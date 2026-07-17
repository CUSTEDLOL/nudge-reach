"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { Container, Section } from "./section";
import { Reveal } from "./motion-primitives";
import { BookDemoButton } from "./book-demo";

/**
 * The comparison that makes the case: respectful, factual, defensible.
 * Everyone can answer a WhatsApp message now — the columns diverge on who
 * actually RUNS the shop. Three honest states (does it / partial / doesn't);
 * every row expands on click to explain the nuance behind the marks, so it
 * reads as a considered ledger, not a marketing checklist.
 */
type Mark = true | false | "partial";

const COLUMNS: { name: string; sub: string }[] = [
  { name: "Meta AI", sub: "Free" },
  { name: "AiSensy", sub: "CRM tool" },
  { name: "WATI", sub: "CRM tool" },
  { name: "Interakt", sub: "CRM tool" },
  { name: "Haptik", sub: "Enterprise" },
  { name: "A hire", sub: "9 hrs/day" },
];

// marks[] aligns to COLUMNS above (6). The Nudge column is always ✓ and is
// rendered separately, highlighted.
const ROWS: { label: string; detail: string; marks: Mark[] }[] = [
  {
    label: "Answers on WhatsApp, 24/7",
    marks: [true, true, true, true, true, false],
    detail:
      "Table stakes now — Meta's free agent made auto-replies free, and every CRM tool has a bot. Answering is where the comparison starts, not where it ends. A hire only covers their shift.",
  },
  {
    label: "Books into your real calendar",
    marks: [false, false, false, false, "partial", true],
    detail:
      "Checking your actual Google Calendar for live availability and holding the slot. Meta's agent books only basic in-app appointments; the CRM tools need you to wire up an integration; Haptik can, but via custom enterprise work. A receptionist just does it — and so does Nudge.",
  },
  {
    label: "Chases quiet leads on its own",
    marks: [false, "partial", "partial", "partial", "partial", "partial"],
    detail:
      "Proactively following up a ghosted lead with no prompt from you. The tools let YOU schedule broadcasts and drips — that's you doing the chasing. A hire can, but only on shift and only if they remember. Nudge chases per-lead, on its own, until they reply or book.",
  },
  {
    label: "Re-engages after the 24-hour window",
    marks: [false, true, true, true, true, false],
    detail:
      "Sending an approved template to reopen a conversation that has gone cold past WhatsApp's 24-hour service window. The CRM tools and Haptik all do this well; Meta's free agent is inbound-only; a hire needs one of these tools to do it at all.",
  },
  {
    label: "Collects payments & deposits in chat",
    marks: [false, "partial", "partial", "partial", "partial", true],
    detail:
      "Dropping a real payment or deposit link into the chat and confirming it's paid. The tools can, through catalog or payment integrations you set up; a hire can paste a link manually. Nudge sends it automatically, the moment a booking is agreed.",
  },
  {
    label: "Works while you sleep",
    marks: [true, true, true, true, true, false],
    detail:
      "Always on. Every software bot here runs 24/7 — so the real question isn't whether it's awake, it's how much of the actual job it does while you are. Only the human hire clocks off.",
  },
  {
    label: "Set up and run FOR you",
    marks: [false, "partial", "partial", "partial", true, false],
    detail:
      "We build the knowledge base, flows, templates and integrations for you — concierge onboarding at an SMB price. The CRM tools give onboarding help but you drive the build; Haptik does managed setup, but at enterprise scale and cost; Meta's agent auto-learns from your page but configures nothing bespoke.",
  },
];

const GRID =
  "grid grid-cols-[minmax(10.5rem,1.3fr)_repeat(6,minmax(4.5rem,1fr))_minmax(6rem,1.05fr)]";

function Mark({ state }: { state: Mark }) {
  if (state === true) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-white">
        <Check className="h-3.5 w-3.5" aria-hidden />
        <span className="sr-only">Yes</span>
      </span>
    );
  }
  if (state === "partial") {
    return (
      <span
        className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-50 ring-1 ring-amber-400/70"
        title="Partial — tap the row for the detail"
      >
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" aria-hidden />
        <span className="sr-only">Partial</span>
      </span>
    );
  }
  return (
    <span className="text-lg font-black leading-none text-ink/40" aria-hidden>
      —<span className="sr-only">No</span>
    </span>
  );
}

export function MetaVsNudge() {
  const [open, setOpen] = useState<number | null>(0);

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
            Meta&rsquo;s free AI{" "}
            <strong className="font-bold text-ink/85">replies to questions</strong>. The CRM tools give
            you software to{" "}
            <strong className="font-bold text-ink/85">operate yourself</strong>. A hire works nine hours.
            The AI Front Desk{" "}
            <strong className="font-bold text-ink/85">does the whole job</strong>.
          </p>
        </Reveal>

        <Reveal className="mt-10">
          {/* legend */}
          <div className="mx-auto mb-4 flex max-w-6xl flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12px] text-ink/50">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-brand-500 text-white">
                <Check className="h-2.5 w-2.5" aria-hidden />
              </span>
              Does it
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-50 ring-1 ring-amber-400/70">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              </span>
              Partial / with setup
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="font-black text-ink/40">—</span> Doesn&rsquo;t
            </span>
            <span className="hidden text-ink/35 sm:inline">·</span>
            <span className="text-ink/40">Tap any row for the detail</span>
          </div>

          <p className="mb-3 text-center text-[12px] font-semibold text-ink/40 lg:hidden">
            Swipe the table → the Nudge column is at the end
          </p>

          <div className="overflow-x-auto">
            <div className="mx-auto min-w-[920px] max-w-6xl overflow-hidden rounded-2xl border-2 border-ink/10 bg-white px-6 py-2 shadow-[10px_10px_0_#d3f8e0]">
              {/* header */}
              <div className={cn(GRID, "items-stretch border-b border-ink/15")}>
                <div className="px-1 py-4" />
                {COLUMNS.map((col) => (
                  <div
                    key={col.name}
                    className="flex flex-col items-center justify-center px-2 py-4 text-center"
                  >
                    <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/60">
                      {col.name}
                    </span>
                    <span className="text-[11px] text-ink/35">{col.sub}</span>
                  </div>
                ))}
                <div className="flex flex-col items-center justify-center rounded-t-xl bg-brand-500 px-2 py-4 text-center">
                  <span className="font-mono text-[12px] font-bold uppercase tracking-[0.06em] text-white">
                    Nudge
                  </span>
                  <span className="text-[11px] text-brand-50/80">AI Front Desk</span>
                </div>
              </div>

              {/* rows */}
              {ROWS.map((row, i) => {
                const isOpen = open === i;
                const isLast = i === ROWS.length - 1;
                return (
                  <div key={row.label}>
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : i)}
                      aria-expanded={isOpen}
                      className={cn(
                        GRID,
                        "group w-full items-center border-b border-ink/[0.07] text-left transition-colors duration-150 hover:bg-ink/[0.015]",
                        isLast && !isOpen && "border-b-0"
                      )}
                    >
                      <div className="flex items-center gap-2 py-3.5 pr-3 text-sm font-medium text-ink/80">
                        <ChevronDown
                          className={cn(
                            "h-3.5 w-3.5 shrink-0 text-ink/30 transition-transform duration-200 group-hover:text-ink/60",
                            isOpen && "rotate-180 text-ink/60"
                          )}
                          aria-hidden
                        />
                        {row.label}
                      </div>
                      {row.marks.map((state, j) => (
                        <div key={j} className="flex justify-center py-3.5">
                          <Mark state={state} />
                        </div>
                      ))}
                      <div
                        className={cn(
                          "flex justify-center self-stretch bg-brand-50 py-3.5",
                          isLast && !isOpen && "rounded-b-xl"
                        )}
                      >
                        <Mark state={true} />
                      </div>
                    </button>

                    {isOpen && (
                      <div
                        className={cn(
                          "border-b border-ink/[0.07] bg-ink/[0.02] px-1 py-4 sm:px-9",
                          isLast && "rounded-b-xl border-b-0"
                        )}
                      >
                        <p className="max-w-3xl text-[13.5px] leading-relaxed text-ink/70">
                          <span className="font-semibold text-ink/85">{row.label}:</span>{" "}
                          {row.detail}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <p className="mx-auto mt-5 max-w-2xl text-center text-sm text-ink/50">
            The tools are good software — if you have someone to run them. The
            AI Front Desk is the someone: trained on your business, on shift
            around the clock, set up for you.
          </p>
          <div className="mt-7 flex justify-center">
            <BookDemoButton variant="primary">
              Book a Demo — see it run yours
            </BookDemoButton>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}
