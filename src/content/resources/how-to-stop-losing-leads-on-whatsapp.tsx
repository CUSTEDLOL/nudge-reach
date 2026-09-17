import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";
import {
  formatResourceDate,
  type ResourceRecord,
} from "@/content/resources/manifest";

const LEAD_STATES = [
  {
    name: "New",
    rule: "An enquiry has arrived, but no useful acknowledgement or owner has been recorded.",
  },
  {
    name: "Active",
    rule: "The business or AI Front Desk is answering, qualifying or completing an agreed action.",
  },
  {
    name: "Waiting",
    rule: "A specific reply or decision is required from the lead before work can continue.",
  },
  {
    name: "Follow-up due",
    rule: "The lead has not replied and a consent-safe next message has a clear due time.",
  },
  {
    name: "Closed",
    rule: "The enquiry reached an outcome, was disqualified, was declined or opted out.",
  },
] as const;

const REQUIRED_FIELDS = [
  "Source",
  "Status",
  "Owner",
  "Last inbound time",
  "Next action",
  "Due time",
] as const;

const WEEKLY_AUDIT = [
  "Find open leads with no owner, next action or due time.",
  "Review overdue actions and record why each one was missed.",
  "Check that every scheduled follow-up stopped when the lead replied.",
  "Audit a fixed sample of AI answers against the approved business knowledge.",
  "Confirm opt-outs are blocked from queued and future marketing messages.",
  "Group leaks by source and workflow step, then assign one corrective action.",
] as const;

const LEAD_LOSS_CHECKLIST = [
  "Capture every official Cloud API enquiry with its source and latest inbound-message time.",
  "Assign one of the five lead states and record the reason for each transition.",
  "Give every open conversation one accountable owner.",
  "Write the next action and due time instead of relying on a staff member's memory.",
  "Pause scheduled follow-ups as soon as the lead replies or a person takes over.",
  "Gate marketing on recorded opt-in and keep STOP permanent.",
  "Use an approved message template for business-initiated contact outside the service window.",
  "Review unresolved leads and workflow leaks on the same day every week.",
] as const;

const sectionClass = "border-t border-ink/15 pt-9 sm:pt-11";
const headingClass = "text-2xl font-black tracking-tight text-ink sm:text-3xl";
const bodyClass = "mt-4 space-y-4 text-[1.0625rem] leading-8 text-ink/70";

export default function HowToStopLosingLeadsOnWhatsappGuide({
  resource,
}: {
  resource: ResourceRecord;
}) {
  return (
    <article aria-label={resource.title} className="mx-auto max-w-3xl">
      <header className="mb-12 border-y-2 border-ink py-5 sm:flex sm:items-center sm:justify-between sm:gap-8">
        <div>
          <p className="text-sm font-bold text-ink">By {resource.authorName}</p>
          <p className="mt-1 text-sm text-ink/65">
            Operational lead-management guide
          </p>
        </div>
        <p className="mt-4 text-sm text-ink/65 sm:mt-0 sm:text-right">
          Published{` `}
          <time dateTime={resource.publishedAt}>
            {formatResourceDate(resource.publishedAt)}
          </time>
        </p>
      </header>

      <aside className="mb-14 rounded-2xl border-2 border-ink/70 bg-[#e9f7ff] p-5 shadow-[5px_5px_0_rgba(10,15,13,0.82)] sm:p-6">
        <p className="font-bold text-ink">The operating principle</p>
        <p className="mt-2 leading-7 text-ink/70">
          A WhatsApp lead needs a visible owner, state and next action. AI can
          help the front desk respond and keep the record current, but policy,
          consent and human judgment remain deterministic controls—not prompt
          suggestions.
        </p>
      </aside>

      <div className="space-y-12 sm:space-y-16">
        <section aria-labelledby="next-action" className={sectionClass}>
          <h2 id="next-action" className={headingClass}>
            A lead is lost when the next action disappears
          </h2>
          <div className={bodyClass}>
            <p>
              Slow replies matter, but a fast first message does not prevent a
              lead from being forgotten later. The operational failure occurs
              when nobody can say who owns the conversation, what should happen
              next or when it is due.
            </p>
            <p>
              Treat WhatsApp as an operating queue, not a row of unread chats.
              Each inbound message received through the official WhatsApp Cloud
              API should update a durable lead record. Keep the automation
              grounded in that business&apos;s approved services, hours, prices and
              policies; do not let it become a general-purpose chatbot.
            </p>
            <p>
              The broader{` `}
              <Link
                href="/whatsapp-ai-automation"
                className="font-bold text-brand-700 underline decoration-brand-300 underline-offset-4 hover:text-brand-800"
              >
                WhatsApp AI automation guide
              </Link>{` `}
              explains how replies, actions, follow-ups and human handoff fit
              together as an AI Front Desk.
            </p>
          </div>
        </section>

        <section aria-labelledby="lead-states" className={sectionClass}>
          <h2 id="lead-states" className={headingClass}>
            Use five clear lead states
          </h2>
          <div className={bodyClass}>
            <p>
              Use a small state model that the AI and team apply in the same
              way. A state describes the present condition; the next action
              describes what will change it.
            </p>
            <dl className="grid gap-3 pt-2">
              {LEAD_STATES.map((state) => (
                <div
                  key={state.name}
                  className="rounded-xl border border-ink/10 bg-white p-4 sm:grid sm:grid-cols-[9rem_1fr] sm:gap-5"
                >
                  <dt className="font-black text-ink">{state.name}</dt>
                  <dd className="mt-1 text-sm leading-6 text-ink/65 sm:mt-0">
                    {state.rule}
                  </dd>
                </div>
              ))}
            </dl>
            <p>
              Change state only when an observable event occurs: an inbound
              reply, a completed action, a scheduled follow-up, a handoff or a
              recorded outcome. Store who or what made the change and when.
            </p>
          </div>
        </section>

        <section aria-labelledby="acknowledge-answer" className={sectionClass}>
          <h2 id="acknowledge-answer" className={headingClass}>
            Acknowledge first, then answer accurately
          </h2>
          <div className={bodyClass}>
            <p>
              Acknowledge a new enquiry immediately, create or update its lead
              record and set its state before starting slower work. The
              acknowledgement can confirm that the message arrived without
              pretending the business has answered the question.
            </p>
            <p>
              Build the useful answer from owner-approved knowledge. If the
              source does not contain a reliable answer, say that a person will
              check and hand over the unresolved question with its context. Do
              not invent a price, opening time, availability slot or policy to
              keep the conversation moving.
            </p>
          </div>
        </section>

        <section aria-labelledby="qualification" className={sectionClass}>
          <h2 id="qualification" className={headingClass}>
            Qualify only what the business needs
          </h2>
          <div className={bodyClass}>
            <p>
              Decide the minimum facts required for the next real business
              action. That might be the service requested, location, preferred
              time and a practical constraint. Ask one relevant question at a
              time and explain why a sensitive detail is needed.
            </p>
            <p>
              Separate required information from facts that are merely
              interesting. The AI Front Desk should help a lead reach a booking,
              payment or human decision; it should not turn a simple enquiry
              into an open-ended interview or collect personal data without a
              defined use.
            </p>
          </div>
        </section>

        <section aria-labelledby="owner-deadline" className={sectionClass}>
          <h2 id="owner-deadline" className={headingClass}>
            Give every conversation an owner and deadline
          </h2>
          <div className={bodyClass}>
            <p>
              A practical lead record needs a few explicit fields. Store them in
              the system of record rather than hiding them in a model prompt or
              staff member&apos;s notes.
            </p>
            <ul className="grid gap-3 pt-2 sm:grid-cols-2">
              {REQUIRED_FIELDS.map((field) => (
                <li
                  key={field}
                  className="flex items-center gap-3 rounded-xl bg-cream px-4 py-3 font-bold text-ink/75"
                >
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-brand-700 text-white">
                    <Check className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  {field}
                </li>
              ))}
            </ul>
            <p>
              For example, a lead can be Waiting with the customer as the
              implied responder, while the assigned staff member remains the
              accountable owner. Its next action might be “check for a reply,”
              with a precise due time. When that time arrives, the system can
              decide whether a follow-up is permitted instead of silently
              abandoning the chat.
            </p>
          </div>
        </section>

        <section aria-labelledby="consent-context" className={sectionClass}>
          <h2 id="consent-context" className={headingClass}>
            Follow up with consent and context
          </h2>
          <div className={bodyClass}>
            <p>
              Schedule a follow-up against a recorded next action, not because a
              contact exists in a list. Before sending, check the latest inbound
              message, current state, consent record and opt-out status again.
              Pause every scheduled follow-up when the lead replies, closes the
              enquiry or enters human handoff.
            </p>
            <p>
              A service enquiry does not automatically grant permission for
              unrelated promotions. Send marketing only to people who have
              opted in, retain evidence of that choice and treat STOP as a
              permanent opt-out. A queued job, CSV import or later automation
              must never restore marketing eligibility after STOP.
            </p>
            <p>
              Inside the 24-hour service window measured from the latest
              customer message, a scoped free-form service reply may continue
              the conversation. Outside the 24-hour service window,
              business-initiated contact must use an appropriate approved
              message template and still pass the consent and opt-out checks.
            </p>
          </div>
        </section>

        <section aria-labelledby="human-control" className={sectionClass}>
          <h2 id="human-control" className={headingClass}>
            Stop automation when a person takes over
          </h2>
          <div className={bodyClass}>
            <p>
              Define handoff triggers before launch: a direct request for a
              person, low-confidence knowledge, a complaint, sensitive context,
              an action failure or any exception the business says staff must
              handle. Assign the handoff to a named queue or person and include
              the lead&apos;s intent, collected facts and unresolved question.
            </p>
            <p>
              Mark the conversation as human-controlled before notifying the
              team. That switch must block AI replies and cancel pending
              follow-ups so the customer does not receive competing messages.
              Resume automation only through an explicit staff action with a
              recorded next state.
            </p>
          </div>
        </section>

        <section aria-labelledby="weekly-audit" className={sectionClass}>
          <h2 id="weekly-audit" className={headingClass}>
            Review the leaks every week
          </h2>
          <div className={bodyClass}>
            <p>
              Run the audit on a fixed day with an owner and a saved view. The
              goal is to find where the operating record stopped matching the
              real conversation, then repair the workflow rather than blame the
              inbox.
            </p>
            <ol className="space-y-3 pt-2">
              {WEEKLY_AUDIT.map((item, index) => (
                <li
                  key={item}
                  className="flex gap-4 rounded-xl border border-ink/10 bg-white p-4 leading-7 text-ink/70"
                >
                  <span className="font-mono text-sm font-bold text-brand-700">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {item}
                </li>
              ))}
            </ol>
            <p>
              To put a financial value beside the operational review, use the{` `}
              <Link
                href="/tools/whatsapp-lead-leakage-calculator"
                className="font-bold text-brand-700 underline decoration-brand-300 underline-offset-4 hover:text-brand-800"
              >
                WhatsApp lead leakage calculator
              </Link>
              . It is a planning tool based on the assumptions you enter, not a
              benchmark or promised outcome.
            </p>
          </div>
        </section>

        <section aria-labelledby="lead-loss-checklist" className={sectionClass}>
          <h2 id="lead-loss-checklist" className={headingClass}>
            Use the lead-loss checklist
          </h2>
          <ul className="mt-6 space-y-3">
            {LEAD_LOSS_CHECKLIST.map((item) => (
              <li
                key={item}
                className="flex gap-3 rounded-xl border border-ink/10 bg-white p-4 leading-7 text-ink/70"
              >
                <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-md bg-brand-700 text-white">
                  <Check className="h-3.5 w-3.5" aria-hidden />
                </span>
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-10 rounded-[1.75rem] bg-ink p-7 text-white sm:p-9">
            <h3 className="text-xl font-black sm:text-2xl">
              Turn the workflow into an AI Front Desk
            </h3>
            <p className="mt-3 max-w-xl leading-7 text-white/70">
              Nudge connects grounded WhatsApp answers, lead state, real
              business actions, consent-safe follow-up and human handoff—and
              helps the business set the complete workflow up.
            </p>
            <Link
              href="/whatsapp-ai-automation"
              className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-700 px-5 py-3 font-bold text-white transition-colors hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Explore WhatsApp AI automation
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </section>
      </div>
    </article>
  );
}
