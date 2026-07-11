import { ArrowRight } from "lucide-react";
import { ButtonLink } from "./button";
import { Container, Section, SectionHeading } from "./section";
import { Reveal } from "./motion-primitives";

const JOB = [
  {
    verb: "Answer",
    detail: "Services, prices and common questions — in your business's voice.",
  },
  {
    verb: "Book",
    detail: "Checks your actual calendar, locks the slot and confirms it.",
  },
  {
    verb: "Chase",
    detail: "Follows up quiet leads and recovers no-shows with approved templates.",
  },
  {
    verb: "Collect",
    detail: "Sends the deposit link, records payment and schedules the reminder.",
  },
];

const DESK = [
  ["One shared inbox", "Your team can see, assign and take over any conversation."],
  ["Every lead accounted for", "Stages, owners and value stay attached to the customer."],
  ["Outbound that stays compliant", "Opt-in, approved templates and STOP handling are enforced."],
  ["A number you can measure", "Bookings, recovered leads, payments and message costs are visible."],
] as const;

/** The hand-off after the Night Shift story: first define the job being hired,
 * then show the quiet operating system underneath it. No feature-card collage. */
export function FeaturesBento() {
  return (
    <Section id="features" className="border-t border-ink/10 bg-white">
      <Container>
        <SectionHeading
          eyebrow="What you're actually hiring"
          title="A front desk that finishes the job."
          subtitle="The night above is the work. This is what keeps it accountable: four responsibilities on top of one complete WhatsApp operating desk."
        />

        <div className="mt-14 grid gap-14 lg:grid-cols-[1.05fr_.95fr] lg:gap-20">
          <Reveal>
            <section className="bg-ink px-6 py-8 text-white shadow-[12px_12px_0_#06c167] sm:px-9 sm:py-10">
              <div className="flex items-center justify-between border-b border-white/15 pb-5">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-300">
                  The job
                </p>
                <p className="font-mono text-[11px] text-white/40">ON SHIFT · 24/7</p>
              </div>

              <ol className="divide-y divide-white/12">
                {JOB.map((item, index) => (
                  <li
                    key={item.verb}
                    className="grid gap-3 py-6 sm:grid-cols-[3rem_8rem_1fr] sm:items-start"
                  >
                    <span className="font-mono text-xs text-brand-300">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <strong className="font-display text-2xl font-black tracking-[-0.03em]">
                      {item.verb}
                    </strong>
                    <span className="text-[14.5px] leading-relaxed text-white/60">
                      {item.detail}
                    </span>
                  </li>
                ))}
              </ol>

              <div className="border-t border-white/15 pt-6">
                <ButtonLink href="/waitlist" variant="primary-dark">
                  Hire the Front Desk
                  <ArrowRight className="h-4 w-4" />
                </ButtonLink>
              </div>
            </section>
          </Reveal>

          <Reveal delay={0.08}>
            <section className="border-t-4 border-brand-500 pt-7">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-ink/45">
                The desk behind it
              </p>
              <h3 className="mt-4 max-w-lg font-display text-3xl font-black leading-[1.02] tracking-[-0.04em] text-ink sm:text-4xl">
                Software your employee uses. Not software you have to run.
              </h3>
              <p className="mt-5 max-w-lg text-base font-medium leading-relaxed text-ink/58">
                Inbox, leads, campaigns, automations and analytics still exist.
                Their job is to support the Front Desk and give your team control
                whenever a human needs to step in.
              </p>

              <dl className="mt-9 divide-y divide-ink/10 border-y border-ink/15">
                {DESK.map(([term, description]) => (
                  <div key={term} className="grid gap-2 py-5 sm:grid-cols-[11rem_1fr]">
                    <dt className="font-bold text-ink">{term}</dt>
                    <dd className="text-[14.5px] leading-relaxed text-ink/55">
                      {description}
                    </dd>
                  </div>
                ))}
              </dl>

              <p className="mt-6 text-sm font-semibold text-brand-700">
                We configure the knowledge, flows, templates and integrations for you.
              </p>
            </section>
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}
