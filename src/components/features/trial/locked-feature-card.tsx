"use client";

import { useId, useState } from "react";
import {
  CalendarCheck,
  CreditCard,
  HeartHandshake,
  LockKeyhole,
  Megaphone,
  MessagesSquare,
  Mic2,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { UpgradeDialog } from "./upgrade-dialog";

export type LockedFeatureKey =
  | "whatsapp"
  | "calendar"
  | "followups"
  | "payments"
  | "campaigns"
  | "crm"
  | "voice";

export interface LockedTrialFeature {
  key: LockedFeatureKey;
  title: string;
  description: string;
  preview: string;
  paidHref: string;
  icon: LucideIcon;
}

export const TRIAL_LOCKED_FEATURES: readonly LockedTrialFeature[] = [
  {
    key: "whatsapp",
    title: "Connect your WhatsApp number",
    description: "Move from the private test inbox to your official business number with Meta Cloud API setup.",
    preview: "Official number · live inbox · team handoff",
    paidHref: "/settings/whatsapp",
    icon: MessagesSquare,
  },
  {
    key: "calendar",
    title: "Calendar booking",
    description: "Check real availability and book confirmed appointments into your clinic calendar.",
    preview: "Availability checks · confirmations · reminders",
    paidHref: "/bookings",
    icon: CalendarCheck,
  },
  {
    key: "followups",
    title: "Follow up with quiet leads",
    description: "Chase opted-in enquiries that go quiet, remind bookings, and help recover no-shows.",
    preview: "Lead recovery · reminders · approved templates",
    paidHref: "/automations",
    icon: RefreshCw,
  },
  {
    key: "payments",
    title: "Payment links",
    description: "Create secure payment requests inside the conversation and track when they are paid.",
    preview: "Payment requests · status tracking · receipts",
    paidHref: "/settings",
    icon: CreditCard,
  },
  {
    key: "campaigns",
    title: "Campaigns to opted-in customers",
    description: "Send compliant updates to your own consented customer list with approved templates.",
    preview: "Consent gate · Meta templates · delivery reporting",
    paidHref: "/campaigns",
    icon: Megaphone,
  },
  {
    key: "crm",
    title: "CRM sync",
    description: "Write lead and conversation outcomes back to the systems your clinic already uses.",
    preview: "Lead records · status updates · activity history",
    paidHref: "/integrations",
    icon: HeartHandshake,
  },
  {
    key: "voice",
    title: "Voice Front Desk",
    description: "Handle clinic calls with the same grounded knowledge and safe human handoff.",
    preview: "Inbound calls · transcripts · handoff",
    paidHref: "/agent/voice",
    icon: Mic2,
  },
];

export function lockedFeatureForSegment(segment: string): LockedFeatureKey | null {
  const mapping: Record<string, LockedFeatureKey> = {
    settings: "whatsapp",
    bookings: "calendar",
    automations: "followups",
    payments: "payments",
    pay: "payments",
    campaigns: "campaigns",
    templates: "campaigns",
    integrations: "crm",
    contacts: "crm",
    agent: "voice",
  };
  return mapping[segment] ??
    (TRIAL_LOCKED_FEATURES.some((feature) => feature.key === segment)
      ? (segment as LockedFeatureKey)
      : null);
}

export function LockedFeatureCard({
  feature,
  initiallyOpen = false,
}: {
  feature: LockedTrialFeature;
  initiallyOpen?: boolean;
}) {
  const descriptionId = useId();
  const [open, setOpen] = useState(initiallyOpen);
  const Icon = feature.icon;

  return (
    <>
      <Card
        className="relative flex min-h-64 flex-col overflow-hidden p-5"
        aria-describedby={descriptionId}
        data-tour={feature.key === "whatsapp" ? "locked-whatsapp" : undefined}
      >
        <div className="flex items-start justify-between gap-4">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700">
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <span className="text-xs font-medium text-neutral-400">Paid setup</span>
        </div>
        <h2 className="mt-5 text-base font-semibold text-neutral-950">{feature.title}</h2>
        <p id={descriptionId} className="mt-2 text-sm leading-6 text-neutral-500">{feature.description}</p>
        <div className="my-5 flex justify-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-600">
            <LockKeyhole className="h-3.5 w-3.5" aria-hidden /> Locked in the free trial
          </span>
        </div>
        <p className="text-xs leading-5 text-neutral-400">{feature.preview}</p>
        <Button className="mt-auto w-full" variant="secondary" aria-describedby={descriptionId} onClick={() => setOpen(true)}>
          Unlock this
        </Button>
      </Card>
      <UpgradeDialog open={open} onClose={() => setOpen(false)} featureName={feature.title} />
    </>
  );
}
