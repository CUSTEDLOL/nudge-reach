import {
  ArrowRight,
  Inbox,
  KanbanSquare,
  LineChart,
  ShieldCheck,
} from "lucide-react";
import { ButtonLink } from "./button";
import { Container, Section } from "./section";
import { Reveal, Stagger, StaggerItem } from "./motion-primitives";

const DESK = [
  {
    icon: Inbox,
    title: "One shared inbox",
    body: "Your team can see, assign and take over any conversation the moment a human needs to step in.",
  },
  {
    icon: KanbanSquare,
    title: "Every lead accounted for",
    body: "Stages, owners and value stay attached to the customer — nothing lives in someone's head.",
  },
  {
    icon: ShieldCheck,
    title: "Compliant by default",
    body: "Opt-in, Meta-approved templates and automatic STOP handling are enforced in code, not policy.",
  },
  {
    icon: LineChart,
    title: "A number you can measure",
    body: "Bookings, recovered leads, payments collected and message costs — visible every morning.",
  },
];

/** The daylight hand-off after the Night Shift story: the quiet operating
 * desk underneath the AI employee. Minimal, centered, one idea per row. */
export function FeaturesBento() {
  return (
    <Section id="features" className="bg-white">
      <Container>
        <Reveal className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-[2.1rem] font-black uppercase leading-[1.06] tracking-[-0.02em] text-ink sm:text-[2.9rem]">
            Software your employee uses.
            <span className="serif-display mt-3 block text-[1.7rem] normal-case tracking-normal text-ink/85 sm:text-[2.3rem]">
              Not software you have to run.
            </span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-[16px] leading-relaxed text-ink/55">
            Inbox, leads, campaigns and analytics support the Front Desk — and
            give your team control whenever a human steps in.
          </p>
        </Reveal>

        <Stagger className="mx-auto mt-14 grid max-w-5xl grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {DESK.map(({ icon: Icon, title, body }) => (
            <StaggerItem key={title} className="h-full">
              <div className="flex h-full flex-col items-center rounded-2xl border border-black/[0.04] bg-[#f4f6f5] px-6 py-8 text-center">
                <Icon className="h-6 w-6 text-ink/70" aria-hidden />
                <h3 className="mt-4 text-[16px] font-bold text-ink">{title}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-ink/55">
                  {body}
                </p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>

        <Reveal className="mt-12 flex flex-col items-center gap-5 text-center">
          <p className="max-w-xl text-[15px] text-ink/60">
            We configure the{" "}
            <strong className="font-bold text-ink">
              knowledge, flows, templates and integrations
            </strong>{" "}
            for you — that&rsquo;s the &lsquo;done-for-you&rsquo; part.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/waitlist" variant="primary">
              Hire the Front Desk
              <ArrowRight className="h-4 w-4" />
            </ButtonLink>
            <ButtonLink href="/pricing" variant="secondary">
              See pricing
            </ButtonLink>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}
