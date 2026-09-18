import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/marketing/seo/json-ld";
import { LandingShell } from "@/components/marketing/seo/landing-shell";
import { metadataFor, SITE_ORIGIN } from "@/modules/marketing/seo-pages";
import { breadcrumbJsonLd } from "@/modules/marketing/structured-data";

const path = "/whatsapp-ai-automation";
const breadcrumbs = [
  { name: "Home", path: "/" },
  { name: "WhatsApp AI automation", path },
];

const WORKFLOW =
  "Inbound message → consent/context check → grounded answer → qualification → business action → status/owner → compliant follow-up → human handoff";

const ARCHITECTURE_LAYERS = [
  {
    title: "1. Official channel",
    body: "The official WhatsApp Cloud API receives customer messages through a verified webhook and sends replies through the business's connected number.",
  },
  {
    title: "2. Business knowledge",
    body: "Approved services, opening hours, policies, prices and instructions ground each answer. The agent stays scoped to that business instead of acting like a general chatbot.",
  },
  {
    title: "3. Conversation state",
    body: "The system keeps the enquiry, qualification details, consent status, owner and next action together so another message does not restart the process.",
  },
  {
    title: "4. Authorized actions",
    body: "Narrow tools can check availability, create a confirmed booking, share an approved payment link or write the next status into a connected system.",
  },
  {
    title: "5. Safety and handoff",
    body: "Tenant isolation, one controlled model gateway, low-cost approved runtime models, simulation testing and a clear human handoff keep the system bounded and reviewable.",
  },
] as const;

const EXAMPLES = [
  {
    title: "Restaurants",
    body: "Answer menu and opening-hour questions, collect the party size and preferred time, then pass a reservation request to the booking process or a person.",
  },
  {
    title: "Clinics",
    body: "Explain administrative details from clinic-approved knowledge, collect the consultation request and check real availability without giving medical advice.",
  },
  {
    title: "Property enquiries",
    body: "Ask which property, budget range and viewing window matter, record the answers and route the enquiry to the right agent for review.",
  },
  {
    title: "Local services",
    body: "Collect the job type, location and preferred time, then create a clear request for the team instead of leaving the details scattered across chat messages.",
  },
] as const;

export const metadata: Metadata = {
  ...metadataFor(path),
  alternates: { canonical: `${SITE_ORIGIN}${path}` },
};

export default function WhatsAppAiAutomationPage() {
  return (
    <>
      <JsonLd value={breadcrumbJsonLd(breadcrumbs)} />
      <LandingShell
        breadcrumbs={breadcrumbs}
        eyebrow="WhatsApp AI automation guide"
        title="WhatsApp AI automation: from first reply to the next business action"
        intro="A useful WhatsApp AI system does more than answer quickly. It keeps the conversation grounded in your business, captures the lead's context, takes an authorized next action, follows up within the rules and brings in a person when needed."
        ctaTitle="See an AI Front Desk run the complete workflow"
        ctaBody="Nudge connects your WhatsApp conversations to business knowledge, calendars, follow-ups, payment links and your human team, then helps you set up the operating flow."
        surface="whatsapp-ai-automation"
      >
        <div className="space-y-16 sm:space-y-24">
          <section aria-labelledby="definition">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-14">
              <h2
                id="definition"
                className="text-3xl font-black tracking-tight text-ink sm:text-4xl"
              >
                What WhatsApp AI automation means
              </h2>
              <div className="space-y-5 leading-7 text-ink/70">
                <p>
                  WhatsApp AI automation connects an incoming conversation to a
                  business-specific decision and a useful next step. The AI may
                  answer a question, but the wider system also remembers context,
                  qualifies the enquiry, updates its status and decides when a
                  human should take over.
                </p>
                <p>
                  That is different from an auto-reply. An auto-reply can
                  acknowledge that a lead arrived. Useful automation also records
                  what the person needs and completes an authorized next action,
                  such as checking availability or preparing a handoff.
                </p>
              </div>
            </div>
          </section>

          <section aria-labelledby="complete-workflow">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-brand-700">
              One connected operating flow
            </p>
            <h2
              id="complete-workflow"
              className="mt-3 text-3xl font-black tracking-tight text-ink sm:text-4xl"
            >
              The complete workflow
            </h2>
            <p className="mt-4 max-w-3xl leading-7 text-ink/65">
              Each stage should leave enough context for the next stage to act.
              A reply without a status, owner or next action is still an inbox
              task waiting for somebody to notice it.
            </p>
            <div className="mt-8 rounded-[1.75rem] border-2 border-ink/70 bg-ink px-7 py-8 text-white shadow-[8px_8px_0_rgba(6,193,103,0.2)] sm:px-9">
              <p className="break-words font-mono text-sm font-bold leading-8 text-[#9bf0bf]">
                {WORKFLOW}
              </p>
            </div>
          </section>

          <section aria-labelledby="architecture">
            <h2
              id="architecture"
              className="text-3xl font-black tracking-tight text-ink sm:text-4xl"
            >
              The architecture behind the conversation
            </h2>
            <p className="mt-4 max-w-3xl leading-7 text-ink/65">
              Reliable automation separates the messaging channel, approved
              knowledge, conversation state and business actions. That makes
              permissions and failures easier to understand before a live
              customer depends on the flow.
            </p>
            <ol className="mt-8 border-t-2 border-ink">
              {ARCHITECTURE_LAYERS.map((layer) => (
                <li
                  key={layer.title}
                  className="grid gap-3 border-b border-ink/15 py-6 sm:grid-cols-[13rem_1fr] sm:gap-8"
                >
                  <h3 className="font-bold text-ink">{layer.title}</h3>
                  <p className="max-w-2xl leading-7 text-ink/65">{layer.body}</p>
                </li>
              ))}
            </ol>
          </section>

          <section
            aria-labelledby="replies-versus-actions"
            className="rounded-[2rem] bg-[#f8fbf1] p-7 sm:p-10"
          >
            <h2
              id="replies-versus-actions"
              className="text-3xl font-black tracking-tight text-ink sm:text-4xl"
            >
              Replies versus actions
            </h2>
            <div className="mt-8 grid gap-6 md:grid-cols-2">
              <article className="rounded-2xl border border-ink/15 bg-white p-6">
                <p className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-ink/65">
                  Reply only
                </p>
                <h3 className="mt-3 text-xl font-black text-ink">Acknowledge and answer</h3>
                <p className="mt-3 leading-7 text-ink/65">
                  Confirm receipt, answer a known question and tell the person
                  what could happen next. This is useful, but it does not itself
                  complete the work.
                </p>
              </article>
              <article className="rounded-2xl border-2 border-ink/70 bg-white p-6 shadow-[6px_6px_0_rgba(10,15,13,0.82)]">
                <p className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-brand-700">
                  AI Front Desk
                </p>
                <h3 className="mt-3 text-xl font-black text-ink">Record and act</h3>
                <p className="mt-3 leading-7 text-ink/65">
                  Keep the customer&apos;s context, qualify the request, perform the
                  permitted business action and leave a status and owner behind.
                  That is the difference between conversation and operations.
                </p>
              </article>
            </div>
          </section>

          <section aria-labelledby="lead-capture">
            <h2
              id="lead-capture"
              className="text-3xl font-black tracking-tight text-ink sm:text-4xl"
            >
              Lead capture and qualification
            </h2>
            <div className="mt-6 max-w-3xl space-y-5 leading-7 text-ink/65">
              <p>
                Automation does not create demand from nowhere. A lead needs an
                actual source: a website call to action, a QR code, an organic
                enquiry, an opted-in campaign or a click-to-WhatsApp ad.
                Automation handles what happens after that conversation starts.
              </p>
              <p>
                Qualification should collect only the details needed for the
                next decision. The useful fields depend on the business: service
                required, location, preferred time, budget range or another
                owner-approved question. Store the answer once, attach it to the
                conversation and make the next action explicit.
              </p>
            </div>
          </section>

          <section aria-labelledby="follow-up-rules">
            <h2
              id="follow-up-rules"
              className="text-3xl font-black tracking-tight text-ink sm:text-4xl"
            >
              Follow-up rules
            </h2>
            <div className="mt-6 grid gap-6 lg:grid-cols-3">
              <article className="border-t-2 border-ink pt-5">
                <h3 className="font-bold text-ink">Consent comes first</h3>
                <p className="mt-3 leading-7 text-ink/65">
                  Marketing and business-initiated follow-up is for opted-in
                  contacts. An opt-out is permanent: STOP always wins, including
                  after a contact import.
                </p>
              </article>
              <article className="border-t-2 border-ink pt-5">
                <h3 className="font-bold text-ink">Respect the service window</h3>
                <p className="mt-3 leading-7 text-ink/65">
                  Free-form replies belong inside the 24-hour customer service
                  window. Re-engagement outside it uses an approved WhatsApp
                  message template, not an improvised message. Check the current{" "}
                  <a
                    href="https://whatsappbusiness.com/policy/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-brand-700 underline decoration-2 underline-offset-4 hover:text-brand-800"
                  >
                    WhatsApp Business Messaging Policy
                  </a>
                  .
                </p>
              </article>
              <article className="border-t-2 border-ink pt-5">
                <h3 className="font-bold text-ink">Keep a safe exit</h3>
                <p className="mt-3 leading-7 text-ink/65">
                  Sensitive, ambiguous, frustrated or out-of-scope conversations
                  need a human handoff with the relevant context intact.
                </p>
              </article>
            </div>
            <p className="mt-7 max-w-3xl leading-7 text-ink/65">
              The{" "}
              <a
                href="https://developers.facebook.com/documentation/business-messaging/whatsapp/about-the-platform"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-brand-700 underline decoration-2 underline-offset-4 hover:text-brand-800"
              >
                official WhatsApp Cloud API
              </a>{" "}
              is the foundation for this flow. Avoid unofficial browser
              automation that bypasses the platform&apos;s controls or makes
              consent and delivery difficult to audit.
            </p>
          </section>

          <section aria-labelledby="business-examples">
            <h2
              id="business-examples"
              className="text-3xl font-black tracking-tight text-ink sm:text-4xl"
            >
              Business examples
            </h2>
            <p className="mt-4 max-w-3xl leading-7 text-ink/65">
              These are workflow examples, not customer results or performance
              promises. Each business should define its own knowledge, actions,
              escalation rules and measurement.
            </p>
            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              {EXAMPLES.map((example) => (
                <article
                  key={example.title}
                  className="rounded-2xl border border-ink/15 bg-white p-6"
                >
                  <h3 className="text-xl font-black text-ink">{example.title}</h3>
                  <p className="mt-3 leading-7 text-ink/65">{example.body}</p>
                </article>
              ))}
            </div>
          </section>

          <section aria-labelledby="build-versus-buy">
            <h2
              id="build-versus-buy"
              className="text-3xl font-black tracking-tight text-ink sm:text-4xl"
            >
              Build versus buy
            </h2>
            <div className="mt-6 grid gap-8 lg:grid-cols-2">
              <div>
                <h3 className="text-xl font-black text-ink">Build when the system is your product</h3>
                <p className="mt-3 leading-7 text-ink/65">
                  A custom build can make sense when your team can own Cloud API
                  onboarding, webhook reliability, storage, authorization,
                  monitoring, policy changes and the ongoing operational setup.
                </p>
                <Link
                  href="/resources/how-to-build-whatsapp-ai-automation"
                  className="mt-5 inline-flex font-bold text-brand-700 underline decoration-2 underline-offset-4 hover:text-brand-800"
                >
                  Read the official Cloud API build guide
                </Link>
              </div>
              <div>
                <h3 className="text-xl font-black text-ink">Buy when the business outcome is the priority</h3>
                <p className="mt-3 leading-7 text-ink/65">
                  A managed AI Front Desk fits teams that want the knowledge,
                  actions, templates, safeguards and handoff process configured
                  with them rather than maintained as a software project.
                </p>
                <Link
                  href="/pricing"
                  className="mt-5 inline-flex font-bold text-brand-700 underline decoration-2 underline-offset-4 hover:text-brand-800"
                >
                  Compare Nudge plans
                </Link>
              </div>
            </div>
          </section>

          <section aria-labelledby="next-steps">
            <h2
              id="next-steps"
              className="text-3xl font-black tracking-tight text-ink sm:text-4xl"
            >
              Next steps
            </h2>
            <p className="mt-4 max-w-3xl leading-7 text-ink/65">
              Start with the part of the system you need to understand or improve.
              The guides explain implementation and lead operations; the tool
              turns your own inputs into a planning estimate.
            </p>
            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              <Link
                href="/resources/how-to-build-whatsapp-ai-automation"
                className="rounded-2xl border-2 border-ink/70 p-6 font-bold text-ink transition-colors hover:bg-[#d3f8e0]"
              >
                Build WhatsApp AI automation with the official API
              </Link>
              <Link
                href="/resources/how-to-stop-losing-leads-on-whatsapp"
                className="rounded-2xl border-2 border-ink/70 p-6 font-bold text-ink transition-colors hover:bg-[#d3f8e0]"
              >
                Create a workflow that stops leads disappearing
              </Link>
              <Link
                href="/tools/whatsapp-lead-leakage-calculator"
                className="rounded-2xl border-2 border-ink/70 p-6 font-bold text-ink transition-colors hover:bg-[#d3f8e0]"
              >
                Estimate WhatsApp lead leakage with your own inputs
              </Link>
            </div>
          </section>
        </div>
      </LandingShell>
    </>
  );
}
