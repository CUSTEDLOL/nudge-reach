import { Check, Minus, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Container, Section } from "./section";

type Tone = "positive" | "partial" | "negative";

type ComparisonCell = {
  text: string;
  tone: Tone;
};

type ComparisonRow = {
  outcome: string;
  nudge: ComparisonCell;
  meta: ComparisonCell;
  crm: ComparisonCell;
  human: ComparisonCell;
};

const COLUMNS = [
  {
    key: "nudge",
    name: "Nudge",
    detail: "AI Front Desk",
    featured: true,
  },
  {
    key: "meta",
    name: "Meta's free AI",
    detail: "Inbound assistant",
    featured: false,
  },
  {
    key: "crm",
    name: "CRM tools",
    detail: "WATI, AiSensy, Interakt",
    featured: false,
  },
  {
    key: "human",
    name: "Human receptionist",
    detail: "A traditional hire",
    featured: false,
  },
] as const;

const ROWS: ComparisonRow[] = [
  {
    outcome: "Answers every new enquiry",
    nudge: { text: "Instant, grounded replies", tone: "positive" },
    meta: { text: "Yes — inbound", tone: "positive" },
    crm: { text: "When you configure it", tone: "partial" },
    human: { text: "While someone is online", tone: "partial" },
  },
  {
    outcome: "Books into your real calendar",
    nudge: { text: "Checks availability + books", tone: "positive" },
    meta: { text: "No real-system action", tone: "negative" },
    crm: { text: "Possible with setup", tone: "partial" },
    human: { text: "Yes — manually", tone: "partial" },
  },
  {
    outcome: "Chases leads who go quiet",
    nudge: { text: "Automatic follow-up", tone: "positive" },
    meta: { text: "Inbound only", tone: "negative" },
    crm: { text: "You build the automation", tone: "partial" },
    human: { text: "Only when remembered", tone: "partial" },
  },
  {
    outcome: "Sends payment links",
    nudge: { text: "Creates + sends the link", tone: "positive" },
    meta: { text: "Doesn't collect payment", tone: "negative" },
    crm: { text: "Possible with integrations", tone: "partial" },
    human: { text: "Yes — manually", tone: "partial" },
  },
  {
    outcome: "Recovers no-shows",
    nudge: { text: "Reminds + re-engages", tone: "positive" },
    meta: { text: "No outbound recovery", tone: "negative" },
    crm: { text: "You build the campaign", tone: "partial" },
    human: { text: "Manual follow-up", tone: "partial" },
  },
  {
    outcome: "Setup and training",
    nudge: { text: "We do it for you", tone: "positive" },
    meta: { text: "You train it", tone: "partial" },
    crm: { text: "Your team configures it", tone: "partial" },
    human: { text: "You recruit + train", tone: "negative" },
  },
  {
    outcome: "Works after hours",
    nudge: { text: "Always on — 24/7", tone: "positive" },
    meta: { text: "24/7 for inbound", tone: "partial" },
    crm: { text: "Automations only", tone: "partial" },
    human: { text: "Needs shifts", tone: "negative" },
  },
  {
    outcome: "Who operates it?",
    nudge: { text: "Nudge runs it", tone: "positive" },
    meta: { text: "You supervise it", tone: "partial" },
    crm: { text: "Your team", tone: "negative" },
    human: { text: "The employee", tone: "partial" },
  },
];

const TONE_STYLES: Record<Tone, string> = {
  positive: "text-brand-800",
  partial: "text-amber-700",
  negative: "text-red-600",
};

function CellValue({ cell }: { cell: ComparisonCell }) {
  const Icon =
    cell.tone === "positive" ? Check : cell.tone === "partial" ? Minus : X;

  return (
    <span
      className={cn(
        "flex items-start gap-2 text-[13px] font-semibold leading-snug",
        TONE_STYLES[cell.tone]
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{cell.text}</span>
    </span>
  );
}

export function MetaVsNudge() {
  return (
    <Section id="compare" className="overflow-x-clip bg-[#f1f7ec]">
      <Container>
        <header className="mx-auto max-w-3xl text-center">
          <span className="inline-flex rounded-full border border-brand-200 bg-white/80 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-brand-700 shadow-sm">
            Side-by-side
          </span>
          <h2 className="mt-5 text-balance font-display text-[2.2rem] font-black leading-[1.02] tracking-[-0.035em] text-ink sm:text-[3.35rem]">
            Why businesses choose <span className="text-brand-600">Nudge</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-[16px] leading-relaxed text-ink/60 sm:text-[17px]">
            Other tools help your team run WhatsApp. Nudge runs the front desk
            for you.
          </p>
        </header>

        <p className="mt-8 text-center text-[12px] font-semibold text-ink/45 sm:hidden">
          Swipe to compare →
        </p>

        <div
          role="region"
          aria-label="Nudge competitor comparison"
          tabIndex={0}
          className="mx-auto mt-3 max-w-7xl overflow-x-auto rounded-[1.5rem] border-2 border-ink/15 bg-white shadow-[0_24px_70px_-36px_rgba(10,31,26,0.45)] outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-4 sm:mt-10"
        >
          <table className="w-full min-w-[1060px] border-separate border-spacing-0 text-left">
            <caption className="sr-only">
              Nudge compared with Meta&apos;s free AI, WhatsApp CRM tools, and a
              human receptionist
            </caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 z-20 w-[220px] border-b border-r border-ink/15 bg-[#f8faf7] px-5 py-5 text-[12px] font-bold uppercase tracking-[0.12em] text-ink/50"
                >
                  What gets done
                </th>
                {COLUMNS.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={cn(
                      "w-[210px] border-b border-ink/15 px-5 py-5 align-bottom",
                      column.featured
                        ? "bg-brand-500 text-white"
                        : "bg-[#f8faf7] text-ink"
                    )}
                  >
                    {column.featured ? (
                      <span className="mb-2 inline-flex rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em]">
                        Done for you
                      </span>
                    ) : null}
                    <span className="block font-display text-[19px] font-black leading-tight tracking-[-0.02em]">
                      {column.name}
                    </span>
                    <span
                      className={cn(
                        "mt-1 block text-[11px] font-semibold leading-snug",
                        column.featured ? "text-white/80" : "text-ink/45"
                      )}
                    >
                      {column.detail}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, rowIndex) => (
                <tr key={row.outcome}>
                  <th
                    scope="row"
                    className={cn(
                      "sticky left-0 z-10 border-r border-ink/15 bg-white px-5 py-4 text-[13px] font-bold leading-snug text-ink",
                      rowIndex < ROWS.length - 1 && "border-b"
                    )}
                  >
                    {row.outcome}
                  </th>
                  {COLUMNS.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        "px-5 py-4 align-top",
                        rowIndex < ROWS.length - 1 && "border-b border-ink/10",
                        column.featured ? "bg-brand-50" : "bg-white"
                      )}
                    >
                      <CellValue cell={row[column.key]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Container>
    </Section>
  );
}
