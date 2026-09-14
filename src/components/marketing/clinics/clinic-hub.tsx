import {
  ArrowDown,
  CalendarCheck,
  Check,
  Clock3,
  CreditCard,
  MessageSquareReply,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import { LandingShell } from "@/components/marketing/seo/landing-shell";

const REVENUE_LEAKS = [
  {
    title: "After-hours enquiries",
    body: "A prospective patient messages while the team is away. By morning, they may already be speaking with another clinic.",
  },
  {
    title: "Calendar back-and-forth",
    body: "Staff copy available slots into chat, wait for a reply, then return to the calendar. Every hand-off gives the enquiry room to stall.",
  },
  {
    title: "Quiet leads",
    body: "Someone asks about a treatment and then goes silent. Without a timely, compliant follow-up, that paid-for enquiry simply sits in the inbox.",
  },
  {
    title: "Avoidable no-shows",
    body: "Appointments without a reminder or deposit prompt are easier to forget, leaving a gap the clinic has little time to refill.",
  },
] as const;

const FRONT_DESK_FLOW = [
  {
    icon: MessageSquareReply,
    title: "Answer with clinic context",
    body: "Respond from owner-provided knowledge about treatments, preparation, timings and policies — never as a general-purpose chatbot.",
  },
  {
    icon: CalendarCheck,
    title: "Check and create the booking",
    body: "Read real calendar availability, offer suitable slots and create the appointment only after the patient confirms.",
  },
  {
    icon: Clock3,
    title: "Follow up when a lead goes quiet",
    body: "Use approved templates for opted-in contacts outside the service window, so re-engagement stays useful and compliant.",
  },
  {
    icon: CreditCard,
    title: "Share the next payment step",
    body: "Send the clinic's payment link when a deposit is needed, without pretending Nudge processes the payment itself.",
  },
  {
    icon: UserRoundCheck,
    title: "Bring in the team",
    body: "Create a clear human handoff for sensitive, complex or out-of-scope conversations, with the chat context intact.",
  },
] as const;

const RULES = [
  "Official WhatsApp Cloud API only",
  "Outreach only to opted-in contacts",
  "A permanent opt-out that imports cannot reverse",
  "Approved templates outside the 24-hour service window",
  "Knowledge grounded in one business: your clinic",
] as const;

const SETUP_STEPS = [
  "Owner questionnaire",
  "Knowledge review",
  "Calendar connection",
  "Template preparation",
  "End-to-end simulation",
  "Controlled go-live",
] as const;

export function ClinicHub() {
  return (
    <LandingShell
      breadcrumbs={[
        { name: "Home", path: "/" },
        { name: "Clinics", path: "/industries/clinics" },
      ]}
      eyebrow="AI Front Desk for clinics in India"
      title="An AI Front Desk for India's aesthetic dermatology, cosmetic dental and hair transplant clinics."
      intro="Nudge turns WhatsApp enquiries into a clear consultation journey: it answers from your clinic's knowledge, checks your real calendar, creates confirmed bookings, follows up compliantly, shares payment links and brings in your team when a conversation needs a person."
      ctaTitle="See Nudge run your clinic's WhatsApp"
      ctaBody="Walk through an enquiry, a real booking, a compliant follow-up and a human handoff in one practical demo."
      surface="clinic"
    >
      <div className="space-y-16 sm:space-y-24">
        <section aria-labelledby="revenue-leaks-title">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] lg:gap-14">
            <div>
              <h2
                id="revenue-leaks-title"
                className="text-3xl font-black tracking-tight text-ink sm:text-4xl"
              >
                Where clinic revenue leaks
              </h2>
              <p className="mt-4 max-w-md leading-7 text-ink/65">
                For Indian aesthetic dermatology, cosmetic dental and hair
                transplant teams, an enquiry can slip away between the first
                message, a consultation slot and the next follow-up.
              </p>
            </div>

            <div className="border-t-2 border-ink">
              {REVENUE_LEAKS.map((leak) => (
                <article
                  key={leak.title}
                  className="grid gap-2 border-b border-ink/15 py-6 sm:grid-cols-[13rem_1fr] sm:gap-8"
                >
                  <h3 className="font-bold text-ink">{leak.title}</h3>
                  <p className="max-w-2xl leading-7 text-ink/65">{leak.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          aria-labelledby="front-desk-title"
          className="overflow-hidden rounded-[2rem] bg-ink text-white shadow-[12px_14px_0_rgba(6,193,103,0.2)]"
        >
          <div className="grid lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
            <div className="border-b border-white/15 p-7 sm:p-10 lg:border-b-0 lg:border-r">
              <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-[#6fe3a8]">
                From first message to next action
              </p>
              <h2
                id="front-desk-title"
                className="mt-4 text-3xl font-black tracking-tight sm:text-4xl"
              >
                What the Front Desk actually does
              </h2>
              <p className="mt-5 max-w-md leading-7 text-white/65">
                One conversation stays connected to the systems and people that
                move it forward.
              </p>
            </div>

            <ol className="divide-y divide-white/15">
              {FRONT_DESK_FLOW.map((step, index) => {
                const Icon = step.icon;
                return (
                  <li key={step.title} className="relative grid grid-cols-[auto_1fr] gap-4 p-6 sm:gap-5 sm:p-8">
                    <span className="grid h-11 w-11 place-items-center rounded-xl border border-white/20 bg-white/10 text-[#6fe3a8]">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <div>
                      <p className="font-mono text-xs font-bold text-white/45">
                        {String(index + 1).padStart(2, "0")}
                      </p>
                      <h3 className="mt-1 text-lg font-bold">{step.title}</h3>
                      <p className="mt-2 max-w-xl leading-7 text-white/65">{step.body}</p>
                    </div>
                    {index < FRONT_DESK_FLOW.length - 1 ? (
                      <ArrowDown
                        className="absolute bottom-[-0.55rem] left-[2.55rem] z-10 h-4 w-4 rounded-full bg-ink text-[#6fe3a8] sm:left-[3.05rem]"
                        aria-hidden
                      />
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        <section aria-labelledby="rules-title" className="grid gap-8 lg:grid-cols-2 lg:gap-14">
          <div>
            <span className="grid h-12 w-12 place-items-center rounded-2xl border-2 border-ink/70 bg-[#d3f8e0] text-brand-800 shadow-[4px_4px_0_rgba(10,15,13,0.82)]">
              <ShieldCheck className="h-6 w-6" aria-hidden />
            </span>
            <h2 id="rules-title" className="mt-6 text-3xl font-black tracking-tight text-ink sm:text-4xl">
              Built around the rules
            </h2>
            <p className="mt-4 max-w-lg leading-7 text-ink/65">
              Compliance is part of the operating model, not a disclaimer added
              after a campaign is ready to send.
            </p>
          </div>
          <ul className="rounded-[1.75rem] border-2 border-ink/70 bg-[#f8fbf1] p-6 shadow-[8px_8px_0_rgba(10,15,13,0.82)] sm:p-8">
            {RULES.map((rule) => (
              <li key={rule} className="flex gap-3 border-b border-ink/10 py-4 first:pt-0 last:border-b-0 last:pb-0">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-[#06c167] text-white">
                  <Check className="h-4 w-4" aria-hidden />
                </span>
                <span className="font-semibold leading-6 text-ink/75">{rule}</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="setup-title">
          <div className="max-w-2xl">
            <h2 id="setup-title" className="text-3xl font-black tracking-tight text-ink sm:text-4xl">
              Set up with your clinic
            </h2>
            <p className="mt-4 leading-7 text-ink/65">
              We learn how your clinic works, connect the operating pieces and
              prove the complete flow safely before live conversations begin.
            </p>
          </div>
          <ol className="mt-8 grid overflow-hidden rounded-[1.75rem] border-2 border-ink/70 bg-white sm:grid-cols-2 lg:grid-cols-3">
            {SETUP_STEPS.map((step, index) => (
              <li
                key={step}
                className="flex min-h-32 flex-col justify-between border-b border-ink/15 p-6 last:border-b-0 sm:border-r sm:[&:nth-child(2n)]:border-r-0 lg:[&:nth-child(2n)]:border-r lg:[&:nth-child(3n)]:border-r-0 lg:[&:nth-last-child(-n+3)]:border-b-0"
              >
                <span className="font-mono text-xs font-bold text-brand-700">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="mt-6 text-lg font-bold text-ink">{step}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </LandingShell>
  );
}
