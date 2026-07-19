import type { Metadata } from "next";
import { LegalDoc, type LegalSection } from "@/components/marketing/legal-doc";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Nudge collects, uses, stores and protects personal data — for our customers and the contacts they message on WhatsApp.",
};

const UPDATED = "4 July 2026";

const SECTIONS: LegalSection[] = [
  {
    heading: "Who we are",
    body: [
      "Nudge (\"Nudge\", \"we\", \"us\") is an AI Front Desk and WhatsApp marketing platform operated by [Legal Entity Name], [registered address], [jurisdiction]. This Privacy Policy explains how we handle personal data.",
      "We handle personal data in two roles. When you sign up and use Nudge, we are the data controller of your account data. When you use Nudge to message your own customers, you are the controller of your contacts' data and we act as your data processor — we process that data only to provide the service to you and on your instructions.",
    ],
  },
  {
    heading: "Data we collect",
    body: [
      "Account data you give us: your name, work email, business name, country, business type, and, if you subscribe to a paid plan, billing details handled by our payment processors (we never see full card numbers).",
      "Contact data you upload or receive: the phone numbers, names, email addresses, tags, notes and message history of the customers you manage in Nudge. You are responsible for having a lawful basis and the necessary consent to process this data.",
      "WhatsApp message data: inbound and outbound message content, delivery and read receipts, and the metadata Meta's WhatsApp Cloud API returns, so we can power the shared inbox, automations and analytics.",
      "Technical data: authentication tokens, IP address and basic request logs used to keep the service secure and running. We do not sell any data or use it for cross-site advertising.",
    ],
  },
  {
    heading: "How we use data",
    body: [
      { list: [
        "To provide the product — inbox, contacts, campaigns, automations, analytics and team collaboration.",
        "To send WhatsApp messages on your behalf through the official Meta WhatsApp Cloud API, subject to opt-in and opt-out rules described below.",
        "To process payments and manage your subscription.",
        "To secure the service, prevent abuse, and comply with legal obligations.",
        "To contact you about your account, service changes and, where you have opted in, product updates.",
      ] },
      "We use AI models (via the Anthropic API) to draft suggested replies and generate campaign copy. Message context is sent to the model provider to produce these outputs and is not used by us to train models. AI-suggested replies are never sent automatically — a person on your team must review and send them.",
    ],
  },
  {
    heading: "Consent, opt-out and WhatsApp policy",
    body: [
      "Nudge is built to comply with Meta's WhatsApp Business Platform policies. Marketing messages are only ever sent to contacts marked as opted in, and this is enforced in our code, not just our interface.",
      "Opt-outs are permanent. When a contact replies STOP (or an equivalent), they are unsubscribed and can never be re-subscribed by a later import. You must obtain valid opt-in before importing contacts for marketing, and you confirm this at import time.",
      "You are responsible for the lawfulness of your messaging and for honouring your contacts' rights. Misuse that risks Meta bans or violates applicable law is grounds for suspension.",
    ],
  },
  {
    heading: "Sharing and sub-processors",
    body: [
      "We share data only with the service providers needed to run Nudge, each bound by data-protection terms:",
      { list: [
        "Meta Platforms — WhatsApp Cloud API message delivery.",
        "Supabase — database, authentication and file storage hosting.",
        "Vercel — application hosting.",
        "Anthropic — AI reply and campaign generation.",
        "Razorpay and Stripe — payment processing (region-dependent).",
        "Resend — transactional email (e.g. team invites), where enabled.",
      ] },
      "We may disclose data if required by law or to protect our rights, users or the public. We do not sell personal data.",
    ],
  },
  {
    heading: "Storage, location and security",
    body: [
      "Data is stored in our cloud infrastructure (currently a single primary region). WhatsApp access tokens are encrypted at rest (AES-256-GCM). Passwords are handled by our authentication provider and never stored by us in plain text. Access to production data is restricted and every workspace's data is isolated from every other workspace at the database level.",
      "No system is perfectly secure, but we apply industry-standard measures — encryption in transit and at rest for secrets, signed webhooks, role-based access, and audit logging of sensitive actions.",
    ],
  },
  {
    heading: "Retention",
    body: [
      "We keep account and contact data for as long as your account is active. When you delete data in the app it is removed from our live systems; residual copies may persist in encrypted backups for a limited period before rotation. On account closure we delete or anonymise personal data within a reasonable period, except where we must retain it to meet legal obligations.",
    ],
  },
  {
    heading: "Your rights",
    body: [
      "Depending on your jurisdiction (including India's DPDP Act and the EU/UK GDPR), you may have the right to access, correct, export, restrict or delete your personal data, and to withdraw consent. Account owners can export contacts and message history from Settings → Data at any time.",
      "To exercise any right, or if you are a contact of a Nudge customer and wish to make a request, email hqnudge@gmail.com. Requests about a customer's contacts are forwarded to that customer, who is the controller of that data.",
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
