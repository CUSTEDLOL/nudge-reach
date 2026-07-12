import { ArrowRight } from "lucide-react";
import { ButtonLink } from "./button";
import { Container, Section, SectionHeading } from "./section";
import { Reveal } from "./motion-primitives";

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
          eyebrow="Behind the Front Desk"
          title="Software your employee uses. Not software you have to run."
          subtitle="Inbox, leads, campaigns, automations and analytics support the Front Desk — and give your team control whenever a human steps in."
        />

        <div className="mt-12 grid gap-10 lg:grid-cols-2 lg:gap-x-20">
          {DESK.map(([term, description]) => (
            <Reveal key={term}>
              <div className="border-t-4 border-brand-500 pt-5">
                <h3 className="font-display text-xl font-black tracking-[-0.02em] text-ink">
                  {term}
                </h3>
                <p className="mt-2 max-w-md text-[15px] leading-relaxed text-ink/60">
                  {description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-12 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-base font-bold text-ink">
            We configure the <strong className="text-brand-700">knowledge, flows, templates and integrations</strong> for you.
          </p>
          <ButtonLink href="/waitlist" variant="primary">
            Hire the Front Desk
            <ArrowRight className="h-4 w-4" />
          </ButtonLink>
        </Reveal>
      </Container>
    </Section>
  );
}
