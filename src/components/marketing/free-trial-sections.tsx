import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CalendarCheck,
  Check,
  FileText,
  LockKeyhole,
  MessageCircleMore,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { BookDemoButton } from "@/components/marketing/book-demo";
import { Container } from "@/components/marketing/section";

const steps = [
  ["01", "Teach it", "Add your clinic website, type key facts, or upload one useful file."],
  ["02", "Test it", "Ask real patient questions in a private inbox and see grounded replies."],
  ["03", "Explore", "Preview the actions the full AI Front Desk can run for your team."],
] as const;

const moats = [
  {
    icon: CalendarCheck,
    title: "Takes real actions",
    body: "The full Front Desk checks availability, books into your real calendar, collects payments, and updates your systems.",
  },
  {
    icon: RefreshCw,
    title: "Chases quiet leads",
    body: "It follows up opted-in leads, sends reminders, and helps recover no-shows with compliant messages.",
  },
  {
    icon: Sparkles,
    title: "Set up with you",
    body: "We configure the knowledge, flows, templates, and integrations so your team buys an outcome—not another tool to assemble.",
  },
] as const;

const faqs = [
  ["What is included?", "You get a safe workspace for 7 days or 15 AI replies, whichever comes first, with no card required."],
  ["Does it connect to my real WhatsApp?", "No. The free trial uses a private test inbox. Connecting a real WhatsApp number is a paid setup step."],
  ["What happens to my information?", "Your trial workspace keeps the clinic information you add so you can resume during the trial. You can ask us to delete it."],
  ["Do you use the official WhatsApp API?", "Yes. Paid WhatsApp connections use the Official WhatsApp API from Meta—never unofficial browser automation."],
  ["What happens when the trial ends?", "AI replies pause. You can book a free demo to plan the full setup or choose a paid plan when you are ready."],
] as const;

export function FreeTrialSections() {
  return (
    <>
      <section className="border-y border-ink/10 bg-white py-16 sm:py-20">
        <Container>
          <div className="max-w-2xl">
            <p className="text-sm font-bold text-brand-700">A focused first run</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-ink sm:text-4xl">
              Learn it in three short steps.
            </h2>
          </div>
          <ol className="mt-10 grid border-y border-ink/10 md:grid-cols-3 md:divide-x md:divide-ink/10">
            {steps.map(([number, title, body]) => (
              <li key={number} className="grid grid-cols-[2.5rem_1fr] gap-3 border-b border-ink/10 py-6 last:border-b-0 md:block md:border-b-0 md:px-7 md:first:pl-0 md:last:pr-0">
                <span className="font-mono text-xs font-bold text-brand-700">{number}</span>
                <div>
                  <h3 className="font-bold text-ink">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-ink/55">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section className="bg-[#f5f8f6] py-16 sm:py-24">
        <Container>
          <div className="grid items-center gap-10 lg:grid-cols-[0.82fr_1.18fr]">
            <div>
              <p className="text-sm font-bold text-brand-700">Inside your trial</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-ink sm:text-4xl">
                One workspace. Nothing to configure twice.
              </h2>
              <p className="mt-4 max-w-lg leading-7 text-ink/60">
                Teach the same AI you test. Your progress, allowance, and next step stay visible throughout.
              </p>
            </div>
            <div className="overflow-hidden rounded-2xl border border-ink/15 bg-white shadow-[0_24px_70px_-36px_rgba(7,38,28,0.5)]">
              <div className="flex items-center justify-between border-b border-ink/10 px-4 py-3">
                <span className="text-sm font-bold text-ink">Aster Clinic workspace</span>
                <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700">15 replies left</span>
              </div>
              <div className="grid sm:grid-cols-[10rem_1fr]">
                <nav aria-label="Trial preview" className="border-b border-ink/10 bg-ink p-3 sm:border-b-0 sm:border-r">
                  {([
                    [Bot, "Train AI", true],
                    [MessageCircleMore, "Test Inbox", false],
                    [LockKeyhole, "Explore", false],
                  ] as const).map(([PreviewIcon, label, active]) => {
                    return (
                      <div key={label} className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold ${active ? "bg-white/12 text-white" : "text-white/55"}`}>
                        <PreviewIcon className="h-4 w-4" aria-hidden />
                        {label}
                      </div>
                    );
                  })}
                </nav>
                <div className="p-5 sm:p-7">
                  <p className="text-xs font-bold text-brand-700">TRAIN AI</p>
                  <h3 className="mt-2 text-lg font-bold text-ink">Give Nudge one useful source</h3>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border-2 border-brand-500 bg-brand-50 p-4">
                      <FileText className="h-5 w-5 text-brand-700" aria-hidden />
                      <p className="mt-5 text-sm font-bold">Clinic website</p>
                      <p className="mt-1 text-xs text-ink/50">Ready to review</p>
                    </div>
                    <div className="rounded-xl border border-ink/10 bg-[#fafbfa] p-4">
                      <LockKeyhole className="h-5 w-5 text-ink/35" aria-hidden />
                      <p className="mt-5 text-sm font-bold">Real WhatsApp</p>
                      <p className="mt-1 text-xs text-ink/50">Unlock after setup</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <section className="bg-ink py-16 text-white sm:py-24">
        <Container>
          <div className="max-w-3xl">
            <p className="text-sm font-bold text-brand-300">Beyond replies</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] sm:text-4xl">
              What the full AI Front Desk runs.
            </h2>
          </div>
          <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 md:grid-cols-3">
            {moats.map(({ icon: Icon, title, body }) => (
              <article key={title} className="bg-ink p-6 sm:p-8">
                <Icon className="h-6 w-6 text-brand-300" aria-hidden />
                <h3 className="mt-8 text-lg font-bold">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/60">{body}</p>
              </article>
            ))}
          </div>
        </Container>
      </section>

      <section className="bg-white py-16 sm:py-24">
        <Container className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr]">
          <div>
            <p className="text-sm font-bold text-brand-700">Clear before you start</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-ink">Free trial FAQ</h2>
          </div>
          <div className="divide-y divide-ink/10 border-y border-ink/10">
            {faqs.map(([question, answer]) => (
              <details key={question} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-500">
                  {question}
                  <span className="text-xl font-normal text-brand-700 group-open:rotate-45 motion-reduce:transform-none">+</span>
                </summary>
                <p className="mt-3 max-w-2xl pr-10 text-sm leading-6 text-ink/60">{answer}</p>
              </details>
            ))}
          </div>
        </Container>
      </section>

      <section className="border-t border-ink/10 bg-[#edf8f1] py-16 sm:py-20">
        <Container className="flex flex-col items-start justify-between gap-7 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-brand-700">
              <Check className="h-4 w-4" aria-hidden /> No card required
            </div>
            <h2 className="mt-3 max-w-2xl text-3xl font-black tracking-[-0.035em] text-ink">
              {"See how Nudge handles your clinic's real questions."}
            </h2>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link href="#start-free-trial" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-500 px-6 font-bold text-white shadow-[0_4px_0_#047f48] hover:bg-brand-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
              Start free trial <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <BookDemoButton surface="free-trial-final" variant="secondary" className="rounded-xl">
              Book a free demo
            </BookDemoButton>
          </div>
        </Container>
      </section>
    </>
  );
}
