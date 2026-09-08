import Image from "next/image";
import { AlertTriangle, Check, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Container, Section } from "./section";

/**
 * "Why businesses choose Nudge" — a plain feature matrix (Wati-style):
 * rows are things an owner cares about, columns are the real alternatives,
 * every cell is a glanceable yes/no/sort-of with a short plain-English note.
 * Static by design; the point lands in two seconds of scanning.
 */

type Mark = "yes" | "no" | "partial";

type Cell = { mark: Mark; note: string };

type Row = {
  feature: string;
  nudge: Cell;
  meta: Cell;
  crm: Cell;
  hire: Cell;
};

const ROWS: Row[] = [
  {
    feature: "Answers customers instantly",
    nudge: { mark: "yes", note: "24/7, trained on your business" },
    meta: { mark: "yes", note: "Basic answers" },
    crm: { mark: "partial", note: "After you build the bots" },
    hire: { mark: "partial", note: "Working hours only" },
  },
  {
    feature: "Books into your real calendar",
    nudge: { mark: "yes", note: "Checks free slots itself" },
    meta: { mark: "no", note: "Not available" },
    crm: { mark: "partial", note: "Only if you wire it up" },
    hire: { mark: "yes", note: "Manually" },
  },
  {
    feature: "Follows up when leads go quiet",
    nudge: { mark: "yes", note: "Automatic, every lead" },
    meta: { mark: "no", note: "Conversations just sit" },
    crm: { mark: "partial", note: "You build the campaigns" },
    hire: { mark: "partial", note: "When they remember" },
  },
  {
    feature: "Collects payments in chat",
    nudge: { mark: "yes", note: "Sends the link itself" },
    meta: { mark: "no", note: "Not available" },
    crm: { mark: "partial", note: "Manual sends" },
    hire: { mark: "yes", note: "Manually" },
  },
  {
    feature: "Time to go live",
    nudge: { mark: "yes", note: "Days, set up for you" },
    meta: { mark: "yes", note: "Instant, but basic" },
    crm: { mark: "partial", note: "Weeks of DIY setup" },
    hire: { mark: "no", note: "Hiring and training" },
  },
  {
    feature: "Runs without you",
    nudge: { mark: "yes", note: "That is the product" },
    meta: { mark: "no", note: "You watch the inbox" },
    crm: { mark: "no", note: "Your team drives it" },
    hire: { mark: "no", note: "Nine to six, then home" },
  },
];

const COLUMNS: {
  key: "nudge" | "meta" | "crm" | "hire";
  label: string;
  sub: string;
  featured?: boolean;
}[] = [
  { key: "nudge", label: "Nudge", sub: "AI Front Desk", featured: true },
  { key: "meta", label: "Meta's free AI", sub: "Built into WhatsApp" },
  { key: "crm", label: "WhatsApp CRM tools", sub: "WATI · AiSensy · Interakt" },
  { key: "hire", label: "Hiring someone", sub: "A human desk" },
];

function MarkIcon({ mark, featured }: { mark: Mark; featured?: boolean }) {
  if (mark === "yes") {
    return (
      <span
        className={cn(
          "grid h-5 w-5 shrink-0 place-items-center rounded-full",
          featured ? "bg-ink text-brand-300" : "bg-brand-100 text-brand-700"
        )}
      >
        <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
        <span className="sr-only">Yes:</span>
      </span>
    );
  }
  if (mark === "no") {
    return (
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-red-100 text-red-600">
        <X className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
        <span className="sr-only">No:</span>
      </span>
    );
  }
  return (
    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-600">
      <AlertTriangle className="h-3 w-3" strokeWidth={3} aria-hidden />
      <span className="sr-only">Partly:</span>
    </span>
  );
}

function CellContent({ cell, featured }: { cell: Cell; featured?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <MarkIcon mark={cell.mark} featured={featured} />
      <span
        className={cn(
          "text-[13px] leading-snug",
          featured ? "font-semibold text-ink" : "font-medium text-ink/70"
        )}
      >
        {cell.note}
      </span>
    </span>
  );
}

export function MetaVsNudge() {
  return (
    <Section id="compare" className="relative overflow-x-clip bg-[#dcf2e3]">
      {/* stage lighting: a soft brand glow behind the matrix */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-24 h-[30rem] w-[64rem] max-w-full -translate-x-1/2 rounded-full bg-brand-400/25 blur-[110px]"
      />
      <Container className="relative">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block -rotate-2 rounded-full border-2 border-ink/70 bg-white px-4 py-1.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink shadow-[3px_3px_0_rgba(10,15,13,0.82)]">
            The honest comparison
          </span>
          <h2 className="mt-6 flex flex-wrap items-baseline justify-center gap-x-3 font-display text-[2.1rem] font-black leading-[1.02] tracking-[-0.03em] text-ink sm:text-[3.2rem]">
            Why businesses choose
            <Image
              src="/logo-mark.png"
              alt="NUDGE"
              width={1570}
              height={334}
              unoptimized
              className="inline-block h-[0.78em] w-auto translate-y-[0.04em]"
            />
          </h2>
          <p className="mt-4 text-[16.5px] leading-relaxed text-ink/60">
            It does the whole job, not just the replies.
          </p>
        </div>

        {/* Desktop: the matrix */}
        <div className="mx-auto mt-10 hidden max-w-6xl overflow-hidden rounded-[1.5rem] border-2 border-ink/70 bg-white shadow-[10px_10px_0_rgba(10,15,13,0.82)] lg:block">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th scope="col" className="w-[22%] border-b-2 border-ink/15 px-5 py-4 text-left text-[12px] font-bold uppercase tracking-[0.1em] text-ink/50">
                  What matters
                </th>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    className={cn(
                      "border-b-2 px-5 py-4 text-left",
                      col.featured
                        ? "border-ink/70 bg-brand-400"
                        : "border-ink/15"
                    )}
                  >
                    <span className={cn("block font-display text-[17px] font-black tracking-[-0.01em]", "text-ink")}>
                      {col.label}
                    </span>
                    <span className={cn("mt-0.5 block text-[11.5px] font-semibold", col.featured ? "text-ink/70" : "text-ink/45")}>
                      {col.sub}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, i) => (
                <tr key={row.feature} className={i % 2 ? "bg-[#fafcf8]" : "bg-white"}>
                  <th scope="row" className="px-5 py-4 text-left text-[14px] font-bold leading-snug text-ink">
                    {row.feature}
                  </th>
                  {COLUMNS.map((col) => (
                    <td
                      key={col.key}
                      className={cn("px-5 py-4 align-middle", col.featured && "bg-brand-50")}
                    >
                      <CellContent cell={row[col.key]} featured={col.featured} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile / tablet: one card per option, Nudge first */}
        <div className="mx-auto mt-8 grid max-w-2xl grid-cols-1 gap-5 lg:hidden">
          {COLUMNS.map((col) => (
            <article
              key={col.key}
              className={cn(
                "overflow-hidden rounded-[1.25rem] border-2 border-ink/70 shadow-[6px_6px_0_rgba(10,15,13,0.82)]",
                col.featured ? "bg-brand-400" : "bg-white"
              )}
            >
              <header className="px-5 pb-3 pt-4">
                <h3 className="font-display text-[19px] font-black tracking-[-0.01em] text-ink">
                  {col.label}
                </h3>
                <p className={cn("text-[12px] font-semibold", col.featured ? "text-ink/70" : "text-ink/45")}>
                  {col.sub}
                </p>
              </header>
              <ul className={cn("space-y-2.5 px-5 pb-5", col.featured && "rounded-t-[1rem] bg-brand-50 pt-4")}>
                {ROWS.map((row) => (
                  <li key={row.feature} className="flex items-start justify-between gap-3">
                    <span className="text-[13px] font-bold leading-snug text-ink">
                      {row.feature}
                    </span>
                    <span className="shrink-0 text-right">
                      <CellContent cell={row[col.key]} featured={col.featured} />
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </Container>
    </Section>
  );
}
