import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck2,
  MessageCircle,
  Rocket,
  Send,
  Sparkles,
  Wrench,
} from "lucide-react";
import { BookDemoButton } from "@/components/marketing/book-demo";
import { Container, Section } from "@/components/marketing/section";

/**
 * Everything below the signup form. Deliberately short: this page takes paid
 * traffic, so each section is one heading and three scannable blocks in the
 * landing page's own idiom — ghost numbers, bordered cards with hard shadows,
 * and a lime card for the thing we most want read.
 */

const steps = [
  {
    icon: Sparkles,
    title: "Train",
    body: "Drop in your website, or the business information customers ask about.",
  },
  {
    icon: MessageCircle,
    title: "Test",
    body: "Ask it real customer questions. Read the answers it would have sent.",
  },
  {
    icon: Rocket,
    title: "Go live",
    body: "Pick a plan and we connect it to your real WhatsApp and calendar.",
  },
] as const;

const outcomes = [
  {
    icon: CalendarCheck2,
    title: "Real actions",
    body: "The paid AI Front Desk books into your real calendar, sends payment links and collects payments.",
    featured: true,
  },
  {
    icon: Send,
    title: "Chases quiet leads",
    body: "It follows up opted-in leads, sends reminders and wins back no-shows — approved templates only.",
    featured: false,
  },
  {
    icon: Wrench,
    title: "Done for you",
    body: "We set it up with you: knowledge, flows, templates and integrations.",
    featured: false,
  },
] as const;

const faqs = [
  [
    "What is in the trial?",
    "A private workspace for 7 days or 15 AI replies, whichever runs out first. No card.",
  ],
  [
    "Does it touch my real WhatsApp?",
    "No. Trial chats stay private. Paid connections run on the Official WhatsApp API from Meta — never browser automation.",
  ],
  [
    "What happens when it ends?",
    "AI replies pause. Everything you taught it stays put while you book a demo or choose a plan.",
  ],
] as const;

export function FreeTrialSections() {
  return (
    <>
      <Section className="bg-white">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-[2rem] font-black uppercase leading-[0.98] tracking-[-0.035em] text-ink sm:text-[2.9rem]">
              Three steps
              <span className="serif-display mt-2 block text-[1.6rem] normal-case tracking-[-0.02em] text-ink/70 sm:text-[2.2rem]">
                to your first answer.
              </span>
            </h2>
          </div>

          <ol className="mx-auto mt-14 grid max-w-5xl grid-cols-1 gap-x-8 gap-y-14 sm:grid-cols-3">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <li key={step.title} className="relative px-2 text-center">
                  {/* the dashed rule that carries the eye to the next step */}
                  {i < steps.length - 1 ? (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute left-[calc(50%+2.25rem)] right-[calc(-50%-0.25rem)] top-7 hidden border-t-2 border-dashed border-ink/20 sm:block"
                    />
                  ) : null}
                  <div className="relative">
                    <span className="relative mx-auto grid h-14 w-14 place-items-center rounded-2xl border-2 border-ink/70 bg-brand-100 text-brand-800 shadow-[4px_4px_0_rgba(10,15,13,0.82)]">
                      <Icon className="h-6 w-6" aria-hidden />
                      <span
                        aria-hidden
                        className="absolute -right-2.5 -top-2.5 grid h-6 w-6 place-items-center rounded-full border-2 border-ink/70 bg-[#ffd94a] font-mono text-[11px] font-black text-ink"
                      >
                        {i + 1}
                      </span>
                    </span>
                    <h3 className="mt-5 font-display text-[19px] font-black leading-tight tracking-[-0.01em] text-ink">
                      {step.title}
                    </h3>
                    <p className="mx-auto mt-2 max-w-[16rem] text-[14px] leading-relaxed text-ink/65">
                      {step.body}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </Container>
      </Section>

      <Section className="bg-[#f8fbf1]">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-[2rem] font-black uppercase leading-[0.98] tracking-[-0.035em] text-ink sm:text-[2.9rem]">
              The trial answers.
              <span className="serif-display mt-2 block text-[1.6rem] normal-case tracking-[-0.02em] text-ink/70 sm:text-[2.2rem]">
                The paid front desk does the work.
              </span>
            </h2>
          </div>

          <div className="mx-auto mt-12 grid max-w-5xl gap-5 sm:grid-cols-3">
            {outcomes.map(({ icon: Icon, title, body, featured }) => (
              <div
                key={title}
                className={
                  featured
                    ? "rounded-[1.25rem] border-2 border-ink/70 bg-[#c9f34f] p-6 shadow-[7px_7px_0_rgba(10,15,13,0.82)]"
                    : "rounded-[1.25rem] border-2 border-ink/70 bg-white p-6 shadow-[5px_5px_0_rgba(10,15,13,0.5)]"
                }
              >
                <span className="grid h-11 w-11 place-items-center rounded-xl border-2 border-ink/70 bg-white text-ink">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-5 font-display text-[18px] font-black leading-tight tracking-[-0.01em] text-ink">
                  {title}
                </h3>
                <p className="mt-2 text-[14px] leading-relaxed text-ink/70">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      <Section className="bg-white">
        <Container className="max-w-3xl">
          <h2 className="text-center font-display text-[2rem] font-black uppercase leading-[0.98] tracking-[-0.035em] text-ink sm:text-[2.6rem]">
            Questions, answered
          </h2>

          <dl className="mt-10 space-y-4">
            {faqs.map(([question, answer], i) => (
              <div
                key={question}
                className="rounded-2xl border-2 border-ink/70 bg-white px-5 py-5 shadow-[5px_5px_0_rgba(10,15,13,0.82)] sm:px-6"
              >
                <dt className="flex items-start gap-4 text-[15.5px] font-black leading-snug text-ink">
                  <span className="mt-0.5 font-mono text-[11px] font-black text-ink/60">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {question}
                </dt>
                <dd className="mt-2 text-[14.5px] leading-relaxed text-ink/65 sm:pl-[2.2rem]">
                  {answer}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <BookDemoButton
              surface="free-trial"
              className="group/cta inline-flex min-h-12 items-center gap-2 rounded-xl bg-ink px-6 py-3 text-[15px] font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_34px_-10px_rgba(6,193,103,0.6)]"
            >
              Book a free demo
              <ArrowRight
                className="h-4 w-4 transition-transform duration-300 group-hover/cta:translate-x-0.5"
                aria-hidden
              />
            </BookDemoButton>
            <Link
              href="/pricing"
              className="inline-flex min-h-12 items-center rounded-xl border-2 border-ink/70 bg-white px-6 py-3 text-[15px] font-semibold text-ink shadow-[4px_4px_0_rgba(10,15,13,0.82)] transition-all hover:-translate-y-0.5"
            >
              View plans
            </Link>
          </div>
        </Container>
      </Section>
    </>
  );
}
