import { cn } from "@/lib/cn";
import { Container, Section } from "./section";

type ComparisonOption = {
  id: string;
  name: string;
  category: string;
  handles: string;
  ownership: string;
  bestFor: string;
  featured?: boolean;
};

const OPTIONS: ComparisonOption[] = [
  {
    id: "nudge-option",
    name: "Nudge AI Front Desk",
    category: "Managed service",
    handles: "Replies, bookings, deposits and quiet-lead recovery.",
    ownership: "Set the rules. Nudge configures and runs it.",
    bestFor: "Owners who want the outcome managed.",
    featured: true,
  },
  {
    id: "meta-option",
    name: "Meta Business Agent",
    category: "Native WhatsApp AI",
    handles: "Questions, recommendations, qualification and appointments.",
    ownership: "Setup, connected workflows and ongoing oversight.",
    bestFor: "Simple AI inside WhatsApp.",
  },
  {
    id: "crm-option",
    name: "WhatsApp CRM tools",
    category: "WATI · AiSensy · Interakt",
    handles: "Inbox, campaigns, AI agents and automations.",
    ownership: "Workflow design, integrations and daily operation.",
    bestFor: "Teams that want platform control.",
  },
  {
    id: "human-option",
    name: "Human receptionist",
    category: "Traditional hire",
    handles: "Conversations, exceptions and manual follow-up.",
    ownership: "Hiring, training, scheduling and cover.",
    bestFor: "Businesses needing human judgment.",
  },
];

const COLUMN_HEADINGS = [
  "Option",
  "What it handles",
  "What you still own",
  "Best for",
] as const;

const MOBILE_FIELDS = [
  { label: "Handles", key: "handles" },
  { label: "You still own", key: "ownership" },
  { label: "Best for", key: "bestFor" },
] as const;

function OptionName({ option }: { option: ComparisonOption }) {
  return (
    <>
      <span className="block font-display text-[1.2rem] font-black uppercase leading-[1.05] tracking-[-0.025em] text-ink xl:text-[1.3rem]">
        {option.name}
      </span>
      <span
        className={cn(
          "mt-2 block text-[14px] font-semibold leading-snug",
          option.featured ? "text-brand-800" : "text-ink/65"
        )}
      >
        {option.category}
      </span>
    </>
  );
}

export function MetaVsNudge() {
  return (
    <Section id="compare" className="bg-white">
      <Container>
        <header className="mx-auto max-w-4xl text-center">
          <p className="text-[12px] font-black uppercase tracking-[0.18em] text-brand-700">
            COMPETITOR ANALYSIS
          </p>
          <h2 className="mt-4 font-display text-[2.1rem] font-black uppercase leading-[1.06] tracking-[-0.02em] text-ink sm:text-[2.9rem]">
            FOUR WAYS TO RUN WHATSAPP.
          </h2>
          <p className="serif-display mx-auto mt-4 max-w-3xl text-[1.35rem] leading-snug text-ink/80 sm:text-[1.75rem]">
            Compare what each handles, what stays with you, and who it fits.
          </p>
        </header>

        <div className="mx-auto mt-12 max-w-6xl overflow-hidden rounded-[1.75rem] border-2 border-ink/70 bg-white shadow-[9px_9px_0_rgba(10,15,13,0.82)]">
          <table className="hidden w-full table-fixed border-collapse lg:table">
            <caption className="sr-only">
              Nudge compared with Meta Business Agent, WhatsApp CRM tools and a
              human receptionist by capabilities, buyer responsibility and best
              fit.
            </caption>
            <colgroup>
              <col className="w-[24%]" />
              <col className="w-[29%]" />
              <col className="w-[28%]" />
              <col className="w-[19%]" />
            </colgroup>
            <thead className="bg-ink text-white">
              <tr>
                {COLUMN_HEADINGS.map((heading, index) => (
                  <th
                    key={heading}
                    scope="col"
                    className={cn(
                      "px-6 py-5 text-left text-[12px] font-black uppercase leading-snug tracking-[0.13em]",
                      index > 0 && "border-l border-white/15"
                    )}
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {OPTIONS.map((option, index) => (
                <tr
                  key={option.id}
                  className={option.featured ? "bg-[#effbdc]" : "bg-white"}
                >
                  <th
                    scope="row"
                    className={cn(
                      "relative border-l-[6px] px-6 py-7 text-left align-top",
                      index > 0 && "border-t-2 border-t-ink/15",
                      option.featured
                        ? "border-l-brand-500"
                        : "border-l-transparent"
                    )}
                  >
                    <OptionName option={option} />
                  </th>
                  <td
                    className={cn(
                      "border-l border-ink/10 px-6 py-7 align-top text-[15px] font-medium leading-[1.5] text-ink/78 xl:text-[16px]",
                      index > 0 && "border-t-2 border-t-ink/15"
                    )}
                  >
                    {option.handles}
                  </td>
                  <td
                    className={cn(
                      "border-l border-ink/10 px-6 py-7 align-top text-[15px] font-medium leading-[1.5] text-ink/78 xl:text-[16px]",
                      index > 0 && "border-t-2 border-t-ink/15"
                    )}
                  >
                    {option.ownership}
                  </td>
                  <td
                    className={cn(
                      "border-l border-ink/10 px-6 py-7 align-top text-[15px] font-bold leading-[1.5] text-ink xl:text-[16px]",
                      index > 0 && "border-t-2 border-t-ink/15"
                    )}
                  >
                    {option.bestFor}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="lg:hidden">
            {OPTIONS.map((option, index) => (
              <section
                key={option.id}
                aria-labelledby={`mobile-${option.id}`}
                className={cn(
                  "px-5 py-7 sm:px-7 sm:py-8",
                  index > 0 && "border-t-2 border-ink/20",
                  option.featured &&
                    "border-l-[6px] border-l-brand-500 bg-[#effbdc] pl-[14px] sm:pl-[22px]"
                )}
              >
                <h3
                  id={`mobile-${option.id}`}
                  className="font-display text-[1.4rem] font-black uppercase leading-[1.05] tracking-[-0.025em] text-ink sm:text-[1.55rem]"
                >
                  {option.name}
                </h3>
                <p
                  className={cn(
                    "mt-2 text-[14px] font-semibold leading-snug",
                    option.featured ? "text-brand-800" : "text-ink/65"
                  )}
                >
                  {option.category}
                </p>

                <dl className="mt-6 grid gap-5 sm:grid-cols-3 sm:gap-6">
                  {MOBILE_FIELDS.map((field) => (
                    <div key={field.key}>
                      <dt className="text-[12px] font-black uppercase leading-snug tracking-[0.12em] text-ink/60">
                        {field.label}
                      </dt>
                      <dd className="mt-2 text-[16px] font-medium leading-[1.5] text-ink/80">
                        {option[field.key]}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        </div>

        <p className="mx-auto mt-5 max-w-6xl text-[13px] font-medium leading-relaxed text-ink/70 sm:text-[14px]">
          Capabilities, services and pricing vary by provider, plan and market.
        </p>
      </Container>
    </Section>
  );
}
