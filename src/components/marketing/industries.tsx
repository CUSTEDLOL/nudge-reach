import {
  Building2,
  GraduationCap,
  Scissors,
  ShoppingBag,
  Stethoscope,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Container, Section } from "./section";
import { Reveal, Stagger, StaggerItem } from "./motion-primitives";
import { TiltCard, TiltChip } from "./tilt-card";

const INDUSTRIES: {
  icon: LucideIcon;
  title: string;
  outcome: string;
  body: string;
}[] = [
  {
    icon: Scissors,
    title: "Salons & spas",
    outcome: "fewer empty chairs",
    body: "Reminders the evening before, a rebooking nudge three weeks later. Chairs stay full without mornings on the phone.",
  },
  {
    icon: Stethoscope,
    title: "Clinics & dentists",
    outcome: "fewer no-shows",
    body: "Tomorrow's appointments confirmed automatically, recall reminders on schedule. People actually read WhatsApp.",
  },
  {
    icon: ShoppingBag,
    title: "Ecommerce & D2C",
    outcome: "recovered orders",
    body: "Abandoned-cart nudges, COD confirmations and delivery updates from one inbox — sales email would have lost.",
  },
  {
    icon: Building2,
    title: "Real estate",
    outcome: "warmer leads",
    body: "Portal enquiries answered in seconds, site-visit details on time, follow-ups through weeks of deciding.",
  },
  {
    icon: GraduationCap,
    title: "Education & coaching",
    outcome: "fuller batches",
    body: "Admission enquiries answered before parents call the next institute. Fee reminders and demo follow-ups, on time.",
  },
  {
    icon: Wrench,
    title: "Local services",
    outcome: "repeat bookings",
    body: "Quotes, confirmations and \u201creaching in 20 minutes\u201d updates — big-brand polish from a two-person team.",
  },
];

export function Industries() {
  return (
    <Section id="industries" className="bg-white">
      <Container>
        <Reveal className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-[2.1rem] font-black uppercase leading-[1.06] tracking-[-0.02em] text-ink sm:text-[2.9rem]">
            If the phone rings all day,
            <span className="serif-display mt-3 block text-[1.7rem] normal-case tracking-normal text-ink/85 sm:text-[2.3rem]">
              Nudge fits.
            </span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-[16px] leading-relaxed text-ink/55">
            From a two-chair salon in Indore to a D2C brand shipping across
            India — if your customers message you, it fits the way you already
            work.
          </p>
        </Reveal>

        <Stagger className="mx-auto mt-14 grid max-w-5xl grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {INDUSTRIES.map(({ icon: Icon, title, outcome, body }) => (
            <StaggerItem key={title} className="h-full">
              <TiltCard surfaceClassName="flex flex-col items-center px-6 py-9 text-center">
                <TiltChip>
                  <Icon className="h-[22px] w-[22px]" aria-hidden />
                </TiltChip>
                <h3 className="mt-5 text-[16px] font-bold text-ink [transform:translateZ(24px)]">
                  {title}
                </h3>
                <p className="serif-display mt-0.5 text-[15px] text-ink/50 [transform:translateZ(18px)]">
                  {outcome}
                </p>
                <p className="mt-3 text-[13.5px] leading-relaxed text-ink/55 [transform:translateZ(10px)]">
                  {body}
                </p>
              </TiltCard>
            </StaggerItem>
          ))}
        </Stagger>
      </Container>
    </Section>
  );
}
