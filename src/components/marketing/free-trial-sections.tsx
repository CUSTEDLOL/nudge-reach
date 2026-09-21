import Link from "next/link";
import { BookDemoButton } from "@/components/marketing/book-demo";
import { Container } from "@/components/marketing/section";

const steps = [
  [
    "1",
    "Train",
    "Add your business website, a useful document, or the facts customers need most.",
  ],
  [
    "2",
    "Test",
    "Ask real customer questions in a private inbox and review grounded replies.",
  ],
  [
    "3",
    "Go live",
    "Choose a paid plan and connect the front desk to your real WhatsApp and systems.",
  ],
] as const;

const outcomes = [
  [
    "Real actions",
    "The paid AI Front Desk books into your real calendar, collects payments, and updates the systems your business already uses.",
  ],
  [
    "Compliant follow-up",
    "It follows up opted-in leads, sends reminders, and helps recover no-shows with approved WhatsApp messages.",
  ],
  [
    "Done-for-you setup",
    "We set it up with you—knowledge, flows, templates, and integrations—so your team gets an outcome, not another tool to assemble.",
  ],
] as const;

const faqs = [
  [
    "What is included in the trial?",
    "A private workspace for 7 days or 15 AI replies, whichever comes first. No card is required.",
  ],
  [
    "Does the trial connect to my real WhatsApp?",
    "No. Trial conversations stay private. Paid connections use the Official WhatsApp API from Meta, never unofficial browser automation.",
  ],
  [
    "What happens when the trial ends?",
    "AI replies pause. Your business information stays available while you book a demo or choose a paid plan.",
  ],
] as const;

export function FreeTrialSections() {
  return (
    <div className="border-t border-ink/10 bg-white">
      <section className="py-16 sm:py-20">
        <Container>
          <h2 className="max-w-xl text-3xl font-bold tracking-[-0.035em] text-ink sm:text-4xl">
            From business facts to a useful answer.
          </h2>
          <ol className="mt-10 border-y border-ink/10">
            {steps.map(([number, title, body]) => (
              <li
                key={number}
                className="grid gap-2 border-b border-ink/10 py-6 last:border-b-0 sm:grid-cols-[3rem_9rem_1fr] sm:items-baseline sm:gap-5"
              >
                <span className="text-sm tabular-nums text-brand-700">
                  {number}
                </span>
                <h3 className="font-bold text-ink">{title}</h3>
                <p className="max-w-2xl text-sm leading-6 text-ink/60">
                  {body}
                </p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section className="border-t border-ink/10 py-16 sm:py-20">
        <Container className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
          <div>
            <h2 className="max-w-sm text-3xl font-bold tracking-[-0.035em] text-ink sm:text-4xl">
              The trial answers. The paid front desk runs the work.
            </h2>
            <p className="mt-4 max-w-md leading-7 text-ink/60">
              Test the knowledge first, then connect Nudge to the tools and
              follow-up work that move leads forward.
            </p>
          </div>
          <div className="border-y border-ink/10">
            {outcomes.map(([title, body]) => (
              <div
                key={title}
                className="grid gap-2 border-b border-ink/10 py-6 last:border-b-0 sm:grid-cols-[11rem_1fr] sm:gap-8"
              >
                <h3 className="font-bold text-ink">{title}</h3>
                <p className="text-sm leading-6 text-ink/60">{body}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="border-t border-ink/10 py-16 sm:py-20">
        <Container className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
          <h2 className="text-3xl font-bold tracking-[-0.035em] text-ink">
            Free trial FAQ
          </h2>
          <dl className="border-y border-ink/10">
            {faqs.map(([question, answer]) => (
              <div
                key={question}
                className="border-b border-ink/10 py-6 last:border-b-0"
              >
                <dt className="font-bold text-ink">{question}</dt>
                <dd className="mt-2 max-w-2xl text-sm leading-6 text-ink/60">
                  {answer}
                </dd>
              </div>
            ))}
          </dl>

          <div className="border-t border-ink/10 pt-7 lg:col-start-2">
            <p className="text-sm leading-6 text-ink/60">
              Want to see the complete setup?{" "}
              <BookDemoButton
                surface="free-trial"
                className="font-semibold text-brand-700 underline underline-offset-4 hover:text-brand-800"
              >
                Book a free demo
              </BookDemoButton>
              <span aria-hidden className="mx-2 text-ink/25">
                ·
              </span>
              <Link
                href="/pricing"
                className="font-semibold text-brand-700 underline underline-offset-4 hover:text-brand-800"
              >
                View plans
              </Link>
            </p>
          </div>
        </Container>
      </section>
    </div>
  );
}
