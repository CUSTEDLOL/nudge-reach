import Link from "next/link";
import { ArrowUpRight, Check, ExternalLink } from "lucide-react";
import {
  formatResourceDate,
  type ResourceRecord,
} from "@/content/resources/manifest";

const ARCHITECTURE_STEPS = [
  "A customer sends a WhatsApp message",
  "Meta delivers a signed webhook event",
  "The application stores and deduplicates the event",
  "Business knowledge and lead state shape the reply",
  "A narrowly authorized action runs when needed",
  "The reply, action result and next step are recorded",
  "A person takes over when policy or judgment requires it",
] as const;

const UAT_CHECKLIST = [
  "Verify webhook challenges, signatures, retries and duplicate events.",
  "Test known questions, unknown questions and deliberately conflicting knowledge.",
  "Confirm every business action checks permissions and validates its inputs.",
  "Exercise opt-in, STOP, open-window replies and approved-template re-engagement.",
  "Force each handoff condition and confirm an owner receives the full context.",
  "Run the journey in simulation before enabling any live send or write action.",
] as const;

const sectionClass = "border-t border-ink/15 pt-9 sm:pt-11";
const headingClass = "text-2xl font-black tracking-tight text-ink sm:text-3xl";
const bodyClass = "mt-4 space-y-4 text-[1.0625rem] leading-8 text-ink/70";

export default function HowToBuildWhatsappAiAutomationGuide({
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
            Technical and operational guide
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
        <p className="font-bold text-ink">Scope of this guide</p>
        <p className="mt-2 leading-7 text-ink/70">
          This is a practical architecture guide, not a promise that one prompt
          can run a business safely. Your implementation must follow Meta&apos;s
          current platform rules, your customers&apos; consent, and the privacy and
          record-keeping obligations that apply to your business.
        </p>
      </aside>

      <div className="space-y-12 sm:space-y-16">
        <section aria-labelledby="business-outcome" className={sectionClass}>
          <h2 id="business-outcome" className={headingClass}>
            Define the business outcome before the bot
          </h2>
          <div className={bodyClass}>
            <p>
              Start with the job a front desk needs to complete: answer an
              approved question, qualify an enquiry, book a verified slot, send
              a payment link, or hand the conversation to a person. Define what
              success means and which facts must be present before that outcome
              is recorded.
            </p>
            <p>
              Keep the first release narrow. A useful automation with a clear
              boundary is safer than a general chatbot that sounds confident but
              cannot verify availability, policy or customer intent. The AI
              should serve one business from that business&apos;s approved knowledge,
              not answer arbitrary questions from the open web.
            </p>
            <p>
              For a broader view of the operating model, read the{` `}
              <Link
                href="/whatsapp-ai-automation"
                className="font-bold text-brand-700 underline decoration-brand-300 underline-offset-4 hover:text-brand-800"
              >
                WhatsApp AI automation pillar
              </Link>
              .
            </p>
          </div>
        </section>

        <section aria-labelledby="official-cloud-api" className={sectionClass}>
          <h2 id="official-cloud-api" className={headingClass}>
            Use the official WhatsApp Cloud API
          </h2>
          <div className={bodyClass}>
            <p>
              Build on Meta&apos;s official Cloud API and a properly configured
              WhatsApp Business Account. Unofficial browser automation is not
              recommended. It depends on a consumer interface, is difficult to
              operate reliably and does not give you the platform controls a
              production business workflow needs.
            </p>
            <p>
              Use the current{` `}
              <a
                href="https://developers.facebook.com/documentation/business-messaging/whatsapp/about-the-platform"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-bold text-brand-700 underline decoration-brand-300 underline-offset-4 hover:text-brand-800"
              >
                Meta WhatsApp Cloud API documentation
                <ExternalLink className="h-4 w-4" aria-hidden />
              </a>{` `}
              as the source of truth for setup, authentication and supported
              behavior. Keep access tokens, app secrets and verification values
              in server-side secret storage. Never place them in browser code,
              article examples, screenshots or source control.
            </p>
          </div>
        </section>

        <section aria-labelledby="verified-webhook" className={sectionClass}>
          <h2 id="verified-webhook" className={headingClass}>
            Receive messages through a verified webhook
          </h2>
          <div className={bodyClass}>
            <p>
              Expose an HTTPS endpoint for the verification challenge and
              inbound events. Validate that a request came from the expected
              platform before accepting its data, reject malformed payloads and
              acknowledge valid deliveries quickly. Put slower work behind a
              durable queue instead of making Meta wait for the AI.
            </p>
            <p>
              Webhooks may be retried, so store the provider&apos;s event or message
              identifier and make processing idempotent. If the same event
              arrives twice, the second delivery must not create another lead,
              book another appointment or send another reply.
            </p>
            <div className="rounded-2xl bg-ink p-6 text-white sm:p-7">
              <p className="text-sm font-black uppercase tracking-[0.14em] text-brand-300">
                Reference flow
              </p>
              <ol className="mt-5 space-y-3">
                {ARCHITECTURE_STEPS.map((step, index) => (
                  <li key={step} className="flex gap-3 leading-7 text-white/75">
                    <span className="font-mono text-sm font-bold text-brand-300">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section aria-labelledby="business-knowledge" className={sectionClass}>
          <h2 id="business-knowledge" className={headingClass}>
            Ground replies in business knowledge
          </h2>
          <div className={bodyClass}>
            <p>
              Build a curated knowledge source from information the owner has
              approved: opening hours, locations, services, pricing rules,
              booking policies, payment instructions and escalation contacts.
              Give every record an owner and a reviewed date so stale facts can
              be found and replaced.
            </p>
            <p>
              Retrieve the smallest relevant set of facts for each message and
              tell the model to answer only from that context. If the answer is
              absent, ambiguous or sensitive, the correct behavior is to say so
              and hand off—not to improvise. Log which knowledge supported the
              answer so staff can investigate mistakes without storing more
              personal data than the workflow needs.
            </p>
          </div>
        </section>

        <section aria-labelledby="narrow-actions" className={sectionClass}>
          <h2 id="narrow-actions" className={headingClass}>
            Give the AI narrow business actions
          </h2>
          <div className={bodyClass}>
            <p>
              Treat every tool as a small, typed business operation. Examples
              include checking calendar availability, creating a provisional
              booking, generating a hosted payment link, updating a lead status
              or requesting a human callback. Validate all inputs on the server
              and scope each read or write to the correct business account.
            </p>
            <p>
              The model may propose an action; deterministic application code
              must authorize and execute it. Recheck availability immediately
              before a booking, require confirmation before material changes
              and record the result. Do not expose a general database query,
              unrestricted HTTP request or open-ended code runner to the model.
            </p>
          </div>
        </section>

        <section aria-labelledby="conversation-state" className={sectionClass}>
          <h2 id="conversation-state" className={headingClass}>
            Track conversation and lead state
          </h2>
          <div className={bodyClass}>
            <p>
              Store durable state outside the prompt: the business, contact,
              conversation, latest inbound-message time, consent status, lead
              stage, owner, next action and the identifiers returned by external
              systems. A short conversation summary can help the model, but it
              must not replace the records used to make operational decisions.
            </p>
            <p>
              Use explicit transitions such as new enquiry, awaiting customer,
              awaiting staff, booked, closed or opted out. Each transition
              should record what caused it. Tenant boundaries belong in every
              query and action, with database controls as a backstop, so one
              business can never retrieve or change another business&apos;s data.
            </p>
          </div>
        </section>

        <section aria-labelledby="service-window" className={sectionClass}>
          <h2 id="service-window" className={headingClass}>
            Enforce the 24-hour service window
          </h2>
          <div className={bodyClass}>
            <p>
              Derive the free-form reply path from the latest customer message.
              When the customer service window is open, the assistant can answer
              within the business&apos;s approved scope. Outside the 24-hour service
              window, a business-initiated follow-up must use an appropriate
              approved message template rather than a free-form AI message.
            </p>
            <p>
              Enforce that choice in the sending code, not only in a prompt.
              Follow-up also requires valid consent. Store consent evidence,
              block contacts without the required opt-in and process STOP as a
              permanent opt-out that queued work or later imports cannot undo.
              Read the{` `}
              <Link
                href="/resources/how-to-stop-losing-leads-on-whatsapp"
                className="font-bold text-brand-700 underline decoration-brand-300 underline-offset-4 hover:text-brand-800"
              >
                WhatsApp lead follow-up guide
              </Link>{` `}
              for the operating workflow around those controls.
            </p>
            <p>
              Check the current{` `}
              <a
                href="https://whatsappbusiness.com/policy/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-bold text-brand-700 underline decoration-brand-300 underline-offset-4 hover:text-brand-800"
              >
                WhatsApp Business Messaging Policy
                <ExternalLink className="h-4 w-4" aria-hidden />
              </a>{` `}
              before launching or changing a live messaging workflow.
            </p>
          </div>
        </section>

        <section aria-labelledby="human-handoff" className={sectionClass}>
          <h2 id="human-handoff" className={headingClass}>
            Design human handoff before launch
          </h2>
          <div className={bodyClass}>
            <p>
              Define handoff triggers before the first live conversation:
              explicit requests for a person, low-confidence answers, complaints,
              payment problems, policy exceptions, sensitive topics and actions
              the automation is not allowed to perform. Tell the customer when
              a person is taking over instead of leaving them in silence.
            </p>
            <p>
              A handoff needs a destination, an owner and enough context to act:
              customer intent, facts already collected, actions attempted and
              the unresolved question. Pause automated replies while a person is
              in control, and make resuming automation an explicit decision.
            </p>
          </div>
        </section>

        <section aria-labelledby="safe-testing" className={sectionClass}>
          <h2 id="safe-testing" className={headingClass}>
            Test the complete system safely
          </h2>
          <div className={bodyClass}>
            <p>
              Build a simulation mode that exercises message intake, retrieval,
              model routing, business actions, follow-up decisions and dashboard
              state without real credentials or external sends. Then run user
              acceptance testing with test contacts and reversible actions before
              enabling production traffic.
            </p>
            <ul className="space-y-3 pt-2">
              {UAT_CHECKLIST.map((item) => (
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
            <p>
              Include failure cases: timeouts, stale knowledge, unavailable
              calendars, duplicate webhooks, rejected templates and a human who
              does not answer immediately. A demo path is not production-ready
              until the unhappy paths are visible and recoverable.
            </p>
          </div>
        </section>

        <section aria-labelledby="build-or-buy" className={sectionClass}>
          <h2 id="build-or-buy" className={headingClass}>
            Decide whether to build or buy
          </h2>
          <div className={bodyClass}>
            <p>
              Building is reasonable when automation is a core capability, your
              team can own platform changes and on-call operations, and the
              workflow is distinctive enough to justify ongoing engineering.
              Buying a managed system is often more practical when the goal is a
              working business outcome and the team would rather own the process
              than the integration stack.
            </p>
            <div className="overflow-x-auto rounded-2xl border border-ink/15">
              <table className="w-full min-w-[42rem] border-collapse text-left text-base">
                <thead className="bg-ink text-white">
                  <tr>
                    <th scope="col" className="px-5 py-4 font-black">Decision area</th>
                    <th scope="col" className="px-5 py-4 font-black">Build internally</th>
                    <th scope="col" className="px-5 py-4 font-black">Use a managed AI Front Desk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/10 bg-white text-ink/70">
                  <tr>
                    <th scope="row" className="px-5 py-4 font-bold text-ink">Control</th>
                    <td className="px-5 py-4">Maximum implementation control</td>
                    <td className="px-5 py-4">Control through configured workflows and policies</td>
                  </tr>
                  <tr>
                    <th scope="row" className="px-5 py-4 font-bold text-ink">Ownership</th>
                    <td className="px-5 py-4">Your team owns hosting, updates and incidents</td>
                    <td className="px-5 py-4">The provider operates the platform; you own business decisions</td>
                  </tr>
                  <tr>
                    <th scope="row" className="px-5 py-4 font-bold text-ink">Best fit</th>
                    <td className="px-5 py-4">A staffed product team with a unique use case</td>
                    <td className="px-5 py-4">A business that wants setup and an operating outcome</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              Neither path removes the business&apos;s responsibility for consent,
              correct knowledge and staff escalation. The honest comparison is
              where the technical and operational work will live—not whether it
              exists.
            </p>

            <div className="rounded-[1.75rem] bg-ink p-7 text-white sm:p-9">
              <h3 className="text-xl font-black sm:text-2xl">
                Turn the architecture into a working front desk
              </h3>
              <p className="mt-3 max-w-xl leading-7 text-white/70">
                Nudge uses the official Cloud API and connects business knowledge,
                real actions, compliant follow-up and human handoff. We help set
                up the workflow; your team remains in control of the business.
              </p>
              <Link
                href="/demo"
                className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-700 px-5 py-3 font-bold text-white transition-colors hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                See the Nudge AI Front Desk
                <ArrowUpRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </article>
  );
}
