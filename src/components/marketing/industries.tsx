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
import { SpotlightCard, Stagger, StaggerItem } from "./motion-primitives";

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
              Built for businesses that{" "}
              <span className="text-gradient">run on WhatsApp</span>
            </>
          }
          subtitle="From a two-chair salon in Indore to a D2C brand shipping across India — if your customers message you, Nudge fits the way you already work."
        />

        <Stagger className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {INDUSTRIES.map(({ icon: Icon, title, outcome, body }) => (
            <StaggerItem key={title} className="h-full">
              <SpotlightCard className="group h-full rounded-3xl border border-black/5 bg-white p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift">
                <div className="relative flex h-full flex-col">
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-100 to-brand-50 text-brand-600 ring-1 ring-brand-200/60 transition-transform duration-300 group-hover:scale-110">
                      <Icon className="h-6 w-6" />
                    </span>
                    <span className="rounded-full bg-brand-50 px-3 py-1 text-[11.5px] font-bold text-brand-700 ring-1 ring-inset ring-brand-200/50">
                      {outcome}
                    </span>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-ink">{title}</h3>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-ink/60">
                    {body}
                  </p>
                </div>
              </SpotlightCard>
            </StaggerItem>
          ))}
        </Stagger>
      </Container>
    </Section>
  );
}
