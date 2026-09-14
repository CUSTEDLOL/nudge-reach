import Link from "next/link";
import { ArrowUpRight, Check, ExternalLink } from "lucide-react";

const JOURNEY_EVENTS = [
  "Enquiry received",
  "Slot offered",
  "Appointment booked",
  "Appointment attended",
  "Appointment rescheduled",
  "No-show recorded",
  "No-show recovered",
] as const;

const CHECKLIST = [
  "Define what counts as a confirmed booking, including the service, staff member, time, location and next step.",
  "Choose one connected calendar as the source of truth for availability.",
  "Write the minimum booking fields and the questions that always go to staff.",
  "Map free-form replies and approved templates around the 24-hour service window.",
  "Prepare confirmation, reminder, reschedule and no-show recovery messages.",
  "Document when a deposit link is sent and how payment status is confirmed.",
  "Give the AI Front Desk explicit human-handoff triggers and destinations.",
  "Test the full flow safely before enabling it for live conversations.",
] as const;

const sectionClass = "border-t border-ink/15 pt-9 sm:pt-11";
const headingClass = "text-2xl font-black tracking-tight text-ink sm:text-3xl";
const bodyClass = "mt-4 space-y-4 text-[1.0625rem] leading-8 text-ink/70";

export default function WhatsappAppointmentBookingForClinicsGuide() {
  return (
    <article aria-label="WhatsApp appointment booking guide" className="mx-auto max-w-3xl">
      <header className="mb-12 border-y-2 border-ink py-5 sm:flex sm:items-center sm:justify-between sm:gap-8">
        <div>
          <p className="text-sm font-bold text-ink">By Nudge team</p>
          <p className="mt-1 text-sm text-ink/55">Operational product guidance</p>
        </div>
        <p className="mt-4 text-sm text-ink/65 sm:mt-0 sm:text-right">
          Published <time dateTime="2026-09-14">14 September 2026</time>
        </p>
      </header>

      <aside className="mb-14 rounded-2xl border-2 border-ink/70 bg-[#e9f7ff] p-5 shadow-[5px_5px_0_rgba(10,15,13,0.82)] sm:p-6">
        <p className="font-bold text-ink">Scope of this guide</p>
        <p className="mt-2 leading-7 text-ink/70">
          This is operational product guidance for appointment workflows. It is
          not medical or legal advice. The clinic remains responsible for care
          decisions, privacy obligations and the policies it gives its team.
        </p>
      </aside>

      <div className="space-y-12 sm:space-y-16">
        <section aria-labelledby="booking-outcome" className={sectionClass}>
          <h2 id="booking-outcome" className={headingClass}>
            Start with the booking outcome, not the bot
          </h2>
          <div className={bodyClass}>
            <p>
              Define the exact state the front desk must reach before designing
              prompts or conversation branches. A booking is confirmed only when
              the requested service, assigned staff member, date and time,
              location and next step are all explicit.
            </p>
            <p>
              If any one of those details is missing, keep the conversation in a
              pending state. Clear status prevents an offered slot from being
              mistaken for a calendar booking.
            </p>
          </div>
        </section>

        <section aria-labelledby="availability-source" className={sectionClass}>
          <h2 id="availability-source" className={headingClass}>
            Keep one availability source of truth
          </h2>
          <div className={bodyClass}>
            <p>
              Check the connected clinic calendar immediately before offering
              times. Filter by the requested service, location and staff rules,
              then present a small set of verified options.
            </p>
            <p>
              Check again before writing the chosen appointment. Never promise an
              opening copied from an old message, a spreadsheet or memory; if the
              calendar cannot be checked, tell the patient that staff will
              confirm the time.
            </p>
          </div>
        </section>

        <section aria-labelledby="minimum-information" className={sectionClass}>
          <h2 id="minimum-information" className={headingClass}>
            Collect only what the clinic needs
          </h2>
          <div className={bodyClass}>
            <p>
              For the booking path, collect the patient&apos;s name, contact
              details, requested service and booking preference. Ask one clear
              question at a time and explain why a detail is needed when that is
              not obvious.
            </p>
            <p>
              Route complex or clinical questions to staff. The booking flow
              should coordinate an appointment, not diagnose, recommend
              treatment or turn the chat into an unnecessary intake form.
            </p>
          </div>
        </section>

        <section aria-labelledby="reply-window" className={sectionClass}>
          <h2 id="reply-window" className={headingClass}>
            Separate replies from re-engagement
          </h2>
          <div className={bodyClass}>
            <p>
              When a patient messages the clinic, the business may reply without
              a message template for 24 hours after that patient&apos;s latest
              message. Once the 24-hour customer service window has closed—or
              when the clinic initiates a conversation—the next outbound message
              must use an approved message template.
            </p>
            <p>
              Store the latest inbound-message time and choose the send path from
              that timestamp. Confirmation, reminder or recovery messages that
              fall outside the window should use an appropriate approved
              template. Only contact people who opted in, and always honour an
              opt-out.
            </p>
            <p>
              These operating rules are paraphrased from the current{` `}
              <a
                href="https://whatsappbusiness.com/policy/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-bold text-brand-700 underline decoration-brand-300 underline-offset-4 hover:text-brand-800"
              >
                WhatsApp Business Messaging Policy
                <ExternalLink className="h-4 w-4" aria-hidden />
              </a>
              , verified 14 September 2026. Recheck Meta&apos;s policy before
              changing a live messaging flow.
            </p>
          </div>
        </section>

        <section aria-labelledby="confirm-remind-recover" className={sectionClass}>
          <h2 id="confirm-remind-recover" className={headingClass}>
            Confirm, remind and recover
          </h2>
          <div className={bodyClass}>
            <p>
              Send a confirmation that repeats the agreed service, date, time,
              location and next action. A reminder should make it easy to confirm
              attendance or request a new time without starting the booking from
              scratch.
            </p>
            <p>
              If the appointment is missed, record the no-show before sending a
              recovery message. Offer a clear route back to verified availability
              and preserve the original booking history rather than silently
              overwriting it.
            </p>
          </div>
        </section>

        <section aria-labelledby="deposits" className={sectionClass}>
          <h2 id="deposits" className={headingClass}>
            Use deposits deliberately
          </h2>
          <div className={bodyClass}>
            <p>
              Send a hosted payment link only when the clinic&apos;s stated booking
              policy requires a deposit. Name the amount and what happens next,
              then read payment status from the provider before marking the
              appointment confirmed.
            </p>
            <p>
              Do not ask a patient to type full card or financial-account details
              into WhatsApp. That handling follows the current{` `}
              <a
                href="https://whatsappbusiness.com/policy/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-bold text-brand-700 underline decoration-brand-300 underline-offset-4 hover:text-brand-800"
              >
                WhatsApp Business Messaging Policy
                <ExternalLink className="h-4 w-4" aria-hidden />
              </a>
              . Keep payment collection with the payment provider and keep the
              conversation focused on the booking status.
            </p>
          </div>
        </section>

        <section aria-labelledby="human-handoff" className={sectionClass}>
          <h2 id="human-handoff" className={headingClass}>
            Design the human handoff
          </h2>
          <div className={bodyClass}>
            <p>
              Define handoff triggers before launch: urgency identified by the
              clinic, uncertainty about an answer, a complaint, or an explicit
              request to speak with a person. Add any clinic-specific trigger the
              automated flow must never handle alone.
            </p>
            <p>
              Tell the patient that the conversation is being handed over, send
              the team the relevant context and leave a visible owner and status.
              A handoff is not complete merely because automation stopped.
            </p>
          </div>
        </section>

        <section aria-labelledby="journey-measurement" className={sectionClass}>
          <h2 id="journey-measurement" className={headingClass}>
            Measure the full journey
          </h2>
          <div className={bodyClass}>
            <p>
              Measure movement through the booking system, not message volume in
              isolation. Use a small event vocabulary that staff can reconcile
              with the connected calendar.
            </p>
            <ol className="grid gap-2 pt-2 sm:grid-cols-2">
              {JOURNEY_EVENTS.map((event, index) => (
                <li key={event} className="flex items-center gap-3 rounded-xl bg-cream px-4 py-3 text-sm font-bold text-ink/75">
                  <span className="font-mono text-xs text-brand-700">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {event}
                </li>
              ))}
            </ol>
            <p>
              Review where enquiries stop, whether offered slots became real
              bookings, and which no-shows later returned to the calendar. Keep
              message delivery and read status as supporting signals rather than
              the booking outcome itself.
            </p>
          </div>
        </section>

        <section aria-labelledby="implementation-checklist" className={sectionClass}>
          <h2 id="implementation-checklist" className={headingClass}>
            Implementation checklist
          </h2>
          <ul className="mt-6 space-y-3">
            {CHECKLIST.map((item) => (
              <li key={item} className="flex gap-3 rounded-xl border border-ink/10 bg-white p-4 leading-7 text-ink/70">
                <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-md bg-[#06c167] text-white">
                  <Check className="h-3.5 w-3.5" aria-hidden />
                </span>
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-10 rounded-[1.75rem] bg-ink p-7 text-white sm:p-9">
            <h3 className="text-xl font-black sm:text-2xl">
              Connect the guide to a working clinic front desk
            </h3>
            <p className="mt-3 max-w-xl leading-7 text-white/70">
              See how Nudge connects WhatsApp, real calendar availability,
              compliant follow-ups, deposits and human handoff for clinics.
            </p>
            <Link
              href="/industries/clinics"
              className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#06c167] px-5 py-3 font-bold text-white transition-colors hover:bg-[#05ac5d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Explore the clinic AI Front Desk
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </section>
      </div>
    </article>
  );
}
