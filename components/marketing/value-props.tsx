import { BarChart3, Inbox, ShieldCheck, Sparkles } from "lucide-react";
import { type LucideIcon } from "lucide-react";
import { Container, Section, SectionHeading } from "./section";
import { SpotlightCard, Stagger, StaggerItem } from "./motion-primitives";

const PILLARS: {
  icon: LucideIcon;
  title: string;
  body: string;
}[] = [
  {
    icon: Inbox,
    title: "One shared inbox",
    body: "Every WhatsApp number and every teammate in a single place. Assign chats, leave private notes, and never reply twice.",
  },
  {
    icon: Sparkles,
    title: "AI does the typing",
    body: "Nudge drafts replies and full campaigns in your brand voice — turning a product photo into a ready-to-send message in seconds.",
  },
  {
    icon: ShieldCheck,
    title: "Compliant by default",
    body: "Opt-in tracking, approved templates and automatic STOP handling keep you inside Meta's rules on every single send.",
  },
  {
    icon: BarChart3,
    title: "Proof, not guesswork",
    body: "See delivered, read and clicked in real time — with the revenue and ₹ cost of every campaign, broadcast and follow-up.",
  },
];

export function ValueProps() {
  return (
    <Section id="why" className="bg-cream">
      <Container>
        <SectionHeading
          eyebrow="Why Nudge"
          title={
            <>
              WhatsApp is where your customers are.
              <br className="hidden sm:block" /> Nudge is how you win there.
            </>
          }
          subtitle="Email gets ignored. Calls get declined. WhatsApp gets read in minutes — Nudge turns that attention into a system your whole team can run."
        />

        <Stagger className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map(({ icon: Icon, title, body }) => (
            <StaggerItem key={title}>
              <SpotlightCard className="group h-full rounded-3xl border border-black/5 bg-white p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift">
                <div className="relative">
                  <span className="inline-grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-100 to-brand-50 text-brand-600 ring-1 ring-brand-200/60 transition-transform duration-300 group-hover:scale-110">
                    <Icon className="h-6 w-6" />
                  </span>
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
