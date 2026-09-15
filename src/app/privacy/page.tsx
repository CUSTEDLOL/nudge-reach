import type { Metadata } from "next";
import { LegalDoc, type LegalSection } from "@/components/marketing/legal-doc";
import { metadataFor } from "@/modules/marketing/seo-pages";

export const metadata: Metadata = metadataFor("/privacy");

const UPDATED = "15 September 2026";

const SECTIONS: LegalSection[] = [
  {
    heading: "Who we are",
    body: [
      "Nudge (\"Nudge\", \"we\", \"us\") is an AI Front Desk and WhatsApp platform operated by [Legal Entity Name], [registered address], [jurisdiction]. The operating entity details must be completed before publication, and qualified legal review is still pending. This operational draft is not legal advice or a claim that counsel or a regulator has approved it.",
      "For account, access-request and demo-booking data, Nudge determines why and how the data is used. When a business uses Nudge to communicate with its own customers, that business controls its contacts' data and Nudge processes the data to provide the service and follow the business's documented instructions, subject to the parties' agreement and applicable law.",
    ],
  },
  {
    heading: "Data we collect",
    body: [
      "Account data you give us: your name, work email, business name, country, business type, and, if you subscribe to a paid plan, billing details handled by our payment processors (we never see full card numbers).",
      "Demo and access-request data you give us: your name, work email, phone or WhatsApp number and form source. If you schedule through Cal.com, we may receive the Cal booking UID, event type, appointment time and the first attendee's name, email and phone. Nudge separately stores its internal lead status and operator-authored notes. Do not put patient, clinical or other special-category information in Nudge's demo forms or booking notes.",
      "Website first-touch attribution is disabled by default. Only the exact value \"true\" for the deployment setting NEXT_PUBLIC_MARKETING_ATTRIBUTION_ENABLED enables Nudge to write first-touch browser local storage, read an existing _ga cookie or forward attribution to Cal.com. When that setting and an approved consent and analytics configuration are in place, we may collect a landing path, origin-only referrer, the UTM source, medium and campaign, and a validated pseudonymous Google Analytics client ID. Aggregate CTA and form events can still enter the GTM data layer while first-touch attribution is off; Google Analytics collection depends on the separately reviewed GTM and server configuration. Arbitrary page query parameters are not forwarded.",
      "Contact data you upload or receive: the phone numbers, names, email addresses, tags, notes and message history of the customers you manage in Nudge. You are responsible for having a lawful basis and the necessary consent to process this data.",
      "WhatsApp message data: inbound and outbound message content, delivery and read receipts, and the metadata Meta's official WhatsApp Cloud API returns, so we can run the shared inbox, AI Front Desk, automations and service analytics.",
      "AI and integration data: owner-provided business knowledge, relevant conversation context, model outputs and tool requests; connected Google Calendar account details and appointment data; and information sent to optional payment, CRM, voice or webhook integrations you configure. Provider credentials and supported tokens are stored encrypted where the product supports a saved connection.",
      "Technical data: authentication tokens, IP address, request and security logs, audit events, and usage records needed to operate, meter and protect the service. We do not sell personal data or use it for cross-site advertising.",
    ],
  },
  {
    heading: "How we use data",
    body: [
      { list: [
        "To provide the AI Front Desk, inbox, contacts, campaigns, automations, business actions, analytics and team collaboration.",
        "To send WhatsApp messages on your behalf through the official Meta WhatsApp Cloud API, subject to opt-in and opt-out rules described below.",
        "To schedule and manage product demos, respond to access requests, operate the founder lead pipeline and follow up with prospects.",
        "When separately approved and enabled, to attribute demo demand, measure aggregate website actions and connect a booked demo to later lead-quality events.",
        "To process payments and manage your subscription.",
        "To secure the service, prevent abuse, and comply with legal obligations.",
        "To contact you about your account, service changes and, where you have opted in, product updates.",
      ] },
      "Nudge's platform-paid AI uses Anthropic. An eligible business may instead connect a customer-supplied API key for an allowed Anthropic, OpenAI or Google model; that key is encrypted at rest. Relevant prompts, business knowledge and conversation context are sent to the selected model provider to produce the requested output. Nudge does not use customer content to train its own general-purpose model. The selected provider's handling is governed by its applicable terms and the business's provider account where a customer-supplied key is used.",
      "Suggested inbox replies and campaign drafts require a team member to review and send or launch them. Separately, when a business enables its AI Front Desk, it can automatically answer inbound messages and perform configured, bounded actions such as checking availability or preparing a booking or payment step. Configured follow-ups can send approved templates. Consent, the 24-hour service window, role checks and deterministic tool validation remain code-enforced rather than being left to the model.",
    ],
  },
  {
    heading: "Consent, opt-out and WhatsApp policy",
    body: [
      "Nudge includes controls designed to support use of Meta's WhatsApp Business Platform policies. Marketing messages are only sent to contacts marked as opted in, and this is enforced in code, not just in the interface. This product control is not a substitute for the business's own legal and policy review.",
      "Opt-outs are permanent. When a contact replies STOP (or an equivalent), they are unsubscribed and can never be re-subscribed by a later import. You must obtain valid opt-in before importing contacts for marketing, and you confirm this at import time.",
      "You are responsible for the lawfulness of your messaging and for honouring your contacts' rights. Misuse that risks Meta bans or violates applicable law is grounds for suspension.",
    ],
  },
  {
    heading: "Sharing and sub-processors",
    body: [
      "We disclose data to service providers only as needed to run a feature, fulfil a request or operate Nudge. Availability, location and the provider's legal role can vary by configuration and contract; this list does not claim that a final sub-processor schedule or legal review has been approved:",
      { list: [
        "Meta Platforms — WhatsApp Cloud API message delivery.",
        "Supabase — database, authentication and file storage hosting.",
        "Vercel — application hosting.",
        "Cal.com — Nudge demo scheduling and signed booking-event delivery.",
        "Google — connected Google Calendar, optional Google Sheets lead forwarding, and Google Analytics 4 measurement when those features are configured and approved.",
        "The selected model provider — Anthropic for the built-in service, or Anthropic, OpenAI or Google when an eligible business connects its own key.",
        "Razorpay and Stripe — payment processing (region-dependent).",
        "Resend — transactional email (e.g. team invites), where enabled.",
        "Other integration providers you choose — such as configured CRM, voice or outbound-webhook recipients — for the data needed to perform that integration.",
      ] },
      "We may disclose data if required by law or to protect our rights, users or the public. We do not sell personal data.",
    ],
  },
  {
    heading: "Storage, location and security",
    body: [
      "Data is stored in our cloud infrastructure, currently using a single primary region. Supported saved secrets, including WhatsApp credentials, Google refresh tokens and customer-supplied model keys, are encrypted at rest with AES-256-GCM. Passwords are handled by our authentication provider and are not stored by Nudge in plain text. Production access is restricted; workspace queries are organization-scoped and database row-level security is used as a backstop.",
      "No system is perfectly secure, but we apply industry-standard measures — encryption in transit and at rest for secrets, signed webhooks, role-based access, and audit logging of sensitive actions.",
    ],
  },
  {
    heading: "Retention",
    body: [
      "We retain account and workspace data while the account is active and as needed to provide the service, resolve disputes, secure the platform and meet legal or accounting obligations. Demo bookings, access requests and waitlist records are retained while needed for scheduling, sales follow-up and legitimate internal records.",
      "We do not currently promise a fixed deletion period for every category. A category-specific retention schedule, including the attribution identifiers described above, must be approved before first-touch attribution and new GA4 lead measurement are activated. When an authorized deletion request is completed, data is removed or de-identified from live systems unless retention is required; residual copies may remain in protected backups until their normal rotation.",
    ],
  },
  {
    heading: "Your rights",
    body: [
      "Applicable law may give you rights to access, correct, export, restrict or delete personal data, object to or withdraw consent for some processing, or complain to an authority. The available rights and exceptions depend on your jurisdiction; this draft does not claim that every listed right applies everywhere.",
      "Workspace administrators can export contacts and message history from Settings → Data. This export does not cover every data category or replace a verified rights request. Demo prospects and other individuals can request access, correction or deletion by emailing hqnudge@gmail.com; we may verify identity and authority before acting.",
      "If the request concerns a Nudge customer's contacts, we normally direct or forward it to that customer as the party controlling the data. We remain responsible for requests concerning data Nudge controls, including account, access-request and demo-booking data.",
    ],
  },
  {
    heading: "Children",
    body: [
      "Nudge is a business tool and is not directed at children. We do not knowingly collect data from anyone under 16.",
    ],
  },
  {
    heading: "Changes",
    body: [
      "We may update this policy as the product and law evolve. Material changes will be notified in-app or by email. The \"last updated\" date above reflects the current version.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalDoc
      title="Privacy Policy"
      updated={UPDATED}
      intro="This policy explains what personal data Nudge collects, how we use and protect it, and the choices and rights you and the people you message have. Plain language, no dark patterns."
      sections={SECTIONS}
    />
  );
}
