import type { Metadata } from "next";
import { LegalDoc, type LegalSection } from "@/components/marketing/legal-doc";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The agreement between Nudge and the businesses that use it — plans, acceptable use, WhatsApp policy compliance, liability and termination.",
};

const UPDATED = "4 July 2026";

const SECTIONS: LegalSection[] = [
  {
    heading: "The agreement",
    body: [
      "These Terms of Service (\"Terms\") are a contract between [Legal Entity Name] (\"Nudge\", \"we\") and the business that creates a Nudge workspace (\"you\"). By signing up or using Nudge you accept these Terms on behalf of your business and confirm you have authority to do so.",
      "Nudge is a business tool. You must be at least 18 and using it for commercial purposes, not as a consumer.",
    ],
  },
  {
    heading: "The service",
    body: [
      "Nudge provides an AI Front Desk for WhatsApp — an AI agent that answers customers, books appointments and follows up — plus a full toolkit: a shared team inbox, contact management, broadcast campaigns, templates, automations, AI-assisted replies and analytics, built on the official Meta WhatsApp Cloud API.",
      "WhatsApp connectivity depends on Meta. You need your own WhatsApp Business Account, phone number and Meta approvals; Meta's own terms and the WhatsApp Business Messaging Policy apply to your use alongside these Terms. We are not responsible for Meta's decisions, including template rejections, rate limits or account restrictions.",
      "Simulation mode is provided for evaluation and demos; messages in simulation are not delivered to real recipients.",
    ],
  },
  {
    heading: "Your account and team",
    body: [
      "You are responsible for your team's use of Nudge, for keeping credentials secure, and for the accuracy of the data you upload. Role permissions (owner, admin, agent) exist to help you control access; assigning a role is your decision and responsibility.",
    ],
  },
  {
    heading: "Acceptable use — messaging rules",
    body: [
      "Because WhatsApp bans numbers for abuse, these rules are enforced in the product and in these Terms:",
      { list: [
        "Marketing messages may only be sent to contacts who gave you valid opt-in consent. You confirm consent at import and before every broadcast.",
        "Opt-outs (e.g. STOP) are honoured permanently and cannot be reversed by re-importing.",
        "No spam, harassment, deception, illegal content, or content prohibited by Meta's policies (including regulated goods restrictions).",
        "No scraping, buying, or messaging harvested phone lists.",
        "No attempts to bypass the official WhatsApp Cloud API, rate limits, or the product's compliance safeguards.",
      ] },
      "We may suspend or terminate accounts that violate these rules, with notice where practicable — including immediately where continued use risks harm to other customers, recipients, or our relationship with Meta.",
    ],
  },
  {
    heading: "Plans, fees and taxes",
    body: [
      "Paid plans are billed monthly in advance in your workspace's billing currency, via Razorpay (INR) or Stripe (other currencies). Plan limits (contacts, team seats, automations, monthly campaign messages) are enforced in the product; you can upgrade at any time.",
      "Meta's per-message/per-conversation charges are separate from Nudge's subscription and are passed through or billed to you by Meta directly, depending on your setup. In-product cost figures are estimates unless marked as billed amounts.",
      "Fees are exclusive of taxes (GST/VAT/sales tax), which are added where applicable. Except where required by law, payments are non-refundable once a billing period has started.",
    ],
  },
  {
    heading: "Your data",
    body: [
      "You own your data — your contacts, messages, templates and campaign content. You grant us the licence needed to host and process it solely to provide the service. Our handling of personal data is described in the Privacy Policy, which forms part of these Terms.",
      "You can export your contacts and message history at any time from Settings → Data.",
    ],
  },
  {
    heading: "AI features",
    body: [
      "AI-generated campaign copy and reply suggestions are drafts. Review them before sending — you are responsible for what your business sends. The AI auto-reply agent answers only from the business information you configure and is designed to hand off to a human rather than guess; you remain responsible for its configuration and its answers.",
    ],
  },
  {
    heading: "Availability and support",
    body: [
      "We aim for high availability but the service is provided \"as is\" and \"as available\", without uptime guarantees on self-serve plans. We may modify features with reasonable notice of material changes. Support is provided by email and WhatsApp during business hours.",
    ],
  },
  {
    heading: "Intellectual property",
    body: [
      "Nudge, its software, design and branding remain our property. These Terms grant you a limited, non-exclusive, non-transferable right to use the service during your subscription. Feedback you give us may be used to improve the product without obligation.",
    ],
  },
  {
    heading: "Liability",
    body: [
      "To the maximum extent permitted by law: (a) neither party is liable for indirect, incidental or consequential damages, or lost profits, revenue or data; (b) our total aggregate liability under these Terms is capped at the fees you paid us in the 12 months before the claim.",
      "Nothing in these Terms limits liability that cannot be limited by law, including for fraud or wilful misconduct.",
      "You will indemnify us against third-party claims arising from your content, your contact data, or your breach of the messaging rules in section 4 — including claims or penalties arising from messaging recipients without valid consent.",
    ],
  },
  {
    heading: "Termination",
    body: [
      "You can cancel at any time; your plan runs to the end of the paid period. We may terminate for material breach (including the acceptable-use rules) or if required by Meta or law. After closure, we delete or anonymise your data as described in the Privacy Policy — export it first.",
    ],
  },
  {
    heading: "General",
    body: [
      "These Terms are governed by the laws of [jurisdiction], with exclusive venue in the courts of [city]. If a provision is unenforceable, the rest remains in effect. These Terms plus the Privacy Policy are the entire agreement and supersede prior discussions. We may update these Terms; material changes will be notified in-app or by email, and continued use after the effective date is acceptance.",
    ],
  },
];

export default function TermsPage() {
  return (
    <LegalDoc
      title="Terms of Service"
      updated={UPDATED}
      intro="The plain-language contract for using Nudge: what we provide, the messaging rules that keep your WhatsApp number safe, what you pay, and where responsibility sits."
      sections={SECTIONS}
    />
  );
}
