import {
  BadgeIndianRupee,
  BellRing,
  Bot,
  CalendarCheck2,
  MessageCircle,
  UserRound,
  Workflow,
} from "lucide-react";
import { Container, Section } from "./section";

const JOURNEY_STEPS = [
  { label: "Replied", icon: MessageCircle },
  { label: "Calendar checked", icon: CalendarCheck2 },
  { label: "Deposit received", icon: BadgeIndianRupee },
  { label: "Follow-up ready", icon: BellRing },
] as const;

const ALTERNATIVES = [
  {
    id: "meta-option",
    title: "Meta's AI",
    description: "A capable agent for incoming conversations.",
    ownership: "You connect + oversee",
    backdropWord: "ASSISTS",
    icon: Bot,
    background:
      "linear-gradient(145deg, #3299ff 0%, #51c9f3 50%, #63e3dc 100%)",
  },
  {
    id: "crm-option",
    title: "CRM tools",
    description: "Powerful software for building WhatsApp workflows.",
    examples: "WATI · AiSensy · Interakt",
    ownership: "Your team or partner operates",
    backdropWord: "TOOLS",
    icon: Workflow,
    background:
      "linear-gradient(145deg, #866cff 0%, #b477f1 48%, #ef79cc 100%)",
  },
  {
    id: "human-option",
    title: "Human receptionist",
    description: "A capable person behind the desk.",
    ownership: "You hire + train + cover shifts",
    backdropWord: "SHIFT",
    icon: UserRound,
    background:
      "linear-gradient(145deg, #ff7b5b 0%, #ff9f55 48%, #ffd34e 100%)",
  },
] as const;

const CARD_MOTION =
  "transition-all duration-300 ease-out motion-safe:hover:-translate-x-1 motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-[13px_13px_0_rgba(10,15,13,0.82)] motion-reduce:transition-none";

export function MetaVsNudge() {
  return (
    <Section id="compare" className="bg-white">
      <Container>
        <header className="mx-auto max-w-4xl text-center">
          <h2 className="font-display text-[2.1rem] font-black uppercase leading-[1.06] tracking-[-0.02em] text-ink sm:text-[2.9rem]">
            THE DIFFERENCE ISN&apos;T MORE FEATURES.
            <span className="serif-display mt-3 block text-[1.7rem] normal-case tracking-normal text-ink/85 sm:text-[2.3rem]">
              It&apos;s who does the work.
            </span>
          </h2>
        </header>

        <div className="relative mx-auto mt-10 flex w-fit max-w-full items-center gap-3 rounded-[1.25rem] border-2 border-ink/70 bg-[#f4fff0] px-4 py-3 shadow-[6px_6px_0_rgba(10,15,13,0.82)] sm:px-5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#1fc16b] text-white">
            <MessageCircle className="h-[18px] w-[18px]" aria-hidden />
          </span>
          <p className="min-w-0 text-left text-[14px] font-bold leading-snug text-ink sm:text-[15px]">
            Hi, is Saturday available?
          </p>
          <time
            dateTime="23:47"
            className="shrink-0 self-end text-[10px] font-bold uppercase tracking-[0.08em] text-ink/45"
          >
            11:47 PM
          </time>
        </div>

        <div aria-hidden className="mx-auto h-9 w-px border-l-2 border-dashed border-ink/35" />

        <div
          role="group"
          aria-label="How Nudge handles the same enquiry compared with alternatives"
          className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(19rem,0.75fr)] lg:gap-7"
        >
          <article
            aria-labelledby="nudge-option"
            className={`group relative flex overflow-hidden rounded-[1.75rem] border-2 border-ink/70 p-6 shadow-[9px_9px_0_rgba(10,15,13,0.82)] sm:p-8 lg:min-h-[37.5rem] lg:p-9 ${CARD_MOTION}`}
            style={{
              background:
                "linear-gradient(135deg, #54e58b 0%, #8eec72 48%, #c9f34f 100%)",
            }}
          >
            <div
              aria-hidden
              className="absolute -bottom-5 -right-3 select-none whitespace-nowrap font-display text-[clamp(6.5rem,14vw,11rem)] font-black uppercase leading-none tracking-[-0.08em] text-white/25 transition-all duration-500 ease-out motion-safe:group-hover:-translate-y-2 motion-safe:group-hover:text-white/40"
            >
              RUNS
            </div>
            <div
              aria-hidden
              className="absolute -bottom-28 -left-20 h-72 w-72 rounded-full border-[42px] border-white/18 transition-transform duration-700 ease-out motion-safe:group-hover:rotate-45 motion-safe:group-hover:scale-110"
            />

            <div className="relative z-10 flex min-w-0 flex-1 flex-col">
              <h3
                id="nudge-option"
                className="w-fit rounded-full border-2 border-ink/70 bg-white/80 px-3.5 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-ink shadow-[3px_3px_0_rgba(10,15,13,0.72)]"
              >
                Nudge AI Front Desk
              </h3>
              <p className="mt-6 max-w-2xl text-balance font-display text-[clamp(2rem,4.1vw,3.65rem)] font-black uppercase leading-[0.95] tracking-[-0.045em] text-ink">
                Booked. Deposit collected.{" "}
                <span className="whitespace-nowrap">Follow-up</span> handled.
              </p>

              <ol className="relative mt-9 grid grid-cols-2 gap-3 before:absolute before:left-[8%] before:right-[8%] before:top-1/2 before:hidden before:-translate-y-1/2 before:border-t-[3px] before:border-dashed before:border-ink/30 before:content-[''] sm:grid-cols-4 sm:gap-4 sm:before:block">
                {JOURNEY_STEPS.map((step, index) => {
                  const Icon = step.icon;

                  return (
                    <li
                      key={step.label}
                      className="relative z-10 flex min-h-[7.5rem] flex-col justify-between rounded-[1.15rem] border-2 border-ink/70 bg-white/90 p-3.5 shadow-[4px_4px_0_rgba(10,15,13,0.72)] sm:min-h-[8rem]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="grid h-9 w-9 place-items-center rounded-full bg-ink text-white">
                          <Icon className="h-[18px] w-[18px]" aria-hidden />
                        </span>
                        <span
                          aria-hidden
                          className="font-display text-[11px] font-black tracking-[0.08em] text-ink/35"
                        >
                          0{index + 1}
                        </span>
                      </div>
                      <span className="max-w-[8rem] text-[12px] font-black uppercase leading-[1.15] tracking-[-0.01em] text-ink sm:text-[13px]">
                        {step.label}
                      </span>
                    </li>
                  );
                })}
              </ol>

              <p className="mt-auto max-w-xl pt-8 text-[14px] font-bold leading-relaxed text-[#075c35] sm:text-[15px]">
                We build it around your business and run the shift.
              </p>
            </div>
          </article>

          <div className="grid gap-5">
            {ALTERNATIVES.map((alternative) => {
              const Icon = alternative.icon;

              return (
                <article
                  key={alternative.id}
                  aria-labelledby={alternative.id}
                  className={`group relative min-h-[11.5rem] overflow-hidden rounded-[1.75rem] border-2 border-ink/70 p-5 shadow-[9px_9px_0_rgba(10,15,13,0.82)] sm:p-6 ${CARD_MOTION}`}
                  style={{ background: alternative.background }}
                >
                  <div
                    aria-hidden
                    className="absolute -bottom-2 -right-1 select-none whitespace-nowrap font-display text-[clamp(3.8rem,7vw,6rem)] font-black uppercase leading-none tracking-[-0.08em] text-white/25 transition-all duration-500 ease-out motion-safe:group-hover:-translate-y-1 motion-safe:group-hover:text-white/40"
                  >
                    {alternative.backdropWord}
                  </div>

                  <div className="relative z-10 grid grid-cols-[auto_minmax(0,1fr)] gap-4">
                    <span className="grid h-11 w-11 place-items-center rounded-[0.9rem] border-2 border-ink/70 bg-white/85 text-ink shadow-[3px_3px_0_rgba(10,15,13,0.72)]">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <h3
                        id={alternative.id}
                        className="font-display text-[1.45rem] font-black uppercase leading-none tracking-[-0.035em] text-ink"
                      >
                        {alternative.title}
                      </h3>
                      <p className="mt-2 text-[13px] font-semibold leading-snug text-ink/75 sm:text-[14px]">
                        {alternative.description}
                      </p>
                      {"examples" in alternative ? (
                        <p className="mt-2 text-[10px] font-black uppercase tracking-[0.09em] text-ink/60 sm:text-[11px]">
                          {alternative.examples}
                        </p>
                      ) : null}
                      <p className="mt-4 w-fit rounded-full border-2 border-ink/60 bg-white/80 px-3 py-1.5 text-[10px] font-black uppercase leading-tight tracking-[0.08em] text-ink">
                        {alternative.ownership}
                      </p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className="mt-12 text-center">
          <p className="inline-flex -rotate-1 rounded-[1rem] border-2 border-ink/70 bg-[#fff2a8] px-5 py-3 font-display text-[1rem] font-black uppercase tracking-[-0.01em] text-ink shadow-[5px_5px_0_rgba(10,15,13,0.82)] sm:px-6 sm:text-[1.15rem]">
            With Nudge, the front desk is the product.
          </p>
        </div>
      </Container>
    </Section>
  );
}
