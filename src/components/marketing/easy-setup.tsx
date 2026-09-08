import { CalendarCheck2, MessageCircle, Rocket, Sparkles } from "lucide-react";
import { Container, Section } from "./section";

/**
 * "Live in days, not months" — four plain steps with big ghost numbers
 * (Wati-style). No motion, no jargon: an owner should read this in ten
 * seconds and think "I can do that".
 */

const STEPS = [
  {
    icon: MessageCircle,
    title: "Connect your WhatsApp",
    body: "Official WhatsApp API. We help you connect it. No code.",
  },
  {
    icon: Sparkles,
    title: "Teach it your business",
    body: "Share your website or price list. It learns your services, prices and timings.",
  },
  {
    icon: CalendarCheck2,
    title: "Try it yourself",
    body: "Message it like a customer. Watch it answer and book a slot.",
  },
  {
    icon: Rocket,
    title: "Go live",
    body: "It answers, books and follows up while you run the business.",
  },
] as const;

export function EasySetup() {
  return (
    <Section id="setup" className="overflow-x-clip bg-white">
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-[2rem] font-black leading-[1.02] tracking-[-0.03em] text-ink sm:text-[2.9rem]">
            Live in days, not months
          </h2>
          <p className="mt-4 text-[16.5px] leading-relaxed text-ink/60">
            Four steps. That&apos;s all it takes.
          </p>
        </div>

        <ol className="mx-auto mt-12 grid max-w-6xl grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <li key={step.title} className="relative px-2 text-center">
                <span
                  aria-hidden
                  className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 select-none font-display text-[7rem] font-black leading-none text-ink/[0.06]"
                >
                  {i + 1}
                </span>
                <div className="relative">
                  <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border-2 border-ink/70 bg-brand-100 text-brand-800 shadow-[4px_4px_0_rgba(10,15,13,0.82)]">
                    <Icon className="h-6 w-6" aria-hidden />
                  </span>
                  <h3 className="mt-5 font-display text-[19px] font-black leading-tight tracking-[-0.01em] text-ink">
                    {step.title}
                  </h3>
                  <p className="mx-auto mt-2 max-w-[15rem] text-[14px] leading-relaxed text-ink/60">
                    {step.body}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </Container>
    </Section>
  );
}
