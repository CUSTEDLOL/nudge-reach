import {
  Building2,
  GraduationCap,
  Scissors,
  ShoppingBag,
  Stethoscope,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Container, Section, SectionHeading } from "./section";
import { Stagger, StaggerItem } from "./motion-primitives";

const INDUSTRIES: {
  icon: LucideIcon;
  title: string;
  outcome: string;
  body: string;
}[] = [
  {
    icon: Scissors,
    title: "Salons & spas",
    outcome: "Fewer empty chairs",
    body: "Appointment reminders go out the evening before, and a rebooking nudge lands three weeks later. Chairs stay full without the front desk spending mornings on the phone.",
  },
  {
    icon: Stethoscope,
    title: "Clinics & dentists",
    outcome: "Fewer no-shows",
    body: "Tomorrow's appointments get confirmed automatically, and recall reminders bring patients back on schedule. People read WhatsApp — so fewer slots go to waste.",
  },
  {
    icon: ShoppingBag,
    title: "Ecommerce & D2C",
    outcome: "Recovered orders",
    body: "Abandoned-cart nudges, COD confirmations and delivery updates run from one inbox. Orders that email would have quietly lost come back as sales.",
  },
  {
    icon: Building2,
    title: "Real estate",
    outcome: "Warmer leads",
    body: "Portal enquiries get answered in seconds with AI drafts, site-visit details go out on time, and follow-ups keep buyers engaged through weeks of deciding.",
  },
  {
    icon: GraduationCap,
    title: "Education & coaching",
    outcome: "Fuller batches",
    body: "Admission enquiries get a reply before parents call the next institute. Fee reminders, batch updates and demo-class follow-ups go out on time, every time.",
  },
  {
    icon: Wrench,
    title: "Local services",
    outcome: "More repeat bookings",
    body: "Quote requests, booking confirmations and “reaching in 20 minutes” updates — the polish of a big brand, from a two-person team.",
  },
];

export function Industries() {
  return (
    <Section id="industries" className="border-y border-black/5 bg-white">
      <Container>
        <SectionHeading
          eyebrow="Who it's for"
          title={
            <>
              If the phone rings all day, Nudge fits.
            </>
          }
          subtitle="From a two-chair salon in Indore to a D2C brand shipping across India — if your customers message you, Nudge fits the way you already work."
        />

        {/* A ledger, not a card grid: numbered rows with hairline rules. */}
        <Stagger className="mt-14 grid grid-cols-1 gap-x-16 lg:grid-cols-2">
          {INDUSTRIES.map(({ icon: Icon, title, outcome, body }, i) => (
            <StaggerItem key={title}>
              <article className="group border-t border-ink/15 py-7 transition-colors duration-300 hover:border-ink/40">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1.5">
                  <span className="font-mono text-[13px] font-semibold tabular-nums text-ink/35">
                    0{i + 1}
                  </span>
                  <h3 className="flex items-center gap-2.5 font-display text-xl font-semibold tracking-tight text-ink">
                    <Icon className="h-[18px] w-[18px] text-brand-600" aria-hidden />
                    {title}
                  </h3>
                  <span className="ml-auto whitespace-nowrap font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-brand-700">
                    {outcome}
                  </span>
                </div>
                <p className="mt-3 max-w-lg pl-9 text-[14.5px] leading-relaxed text-ink/60">
                  {body}
                </p>
              </article>
            </StaggerItem>
          ))}
        </Stagger>
      </Container>
    </Section>
  );
}
