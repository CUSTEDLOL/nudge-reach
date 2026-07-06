import type { Metadata } from "next";
import { Info } from "lucide-react";
import { requireOrgContext } from "@/modules/orgs/auth";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "../section-header";
import {
  NotificationsForm,
  type NotificationPrefs,
} from "./notifications-form";

export const metadata: Metadata = { title: "Notification settings" };

const DEFAULTS: NotificationPrefs = {
  newInboxMessage: true,
  campaignCompleted: true,
  automationFailed: true,
  weeklyDigest: false,
};

export default async function NotificationsSettingsPage() {
  const { membership } = await requireOrgContext();

  const stored =
    typeof membership.notificationPrefs === "object" &&
    membership.notificationPrefs !== null &&
    !Array.isArray(membership.notificationPrefs)
      ? (membership.notificationPrefs as Record<string, unknown>)
      : {};

  const prefs: NotificationPrefs = {
    newInboxMessage:
      typeof stored.newInboxMessage === "boolean"
        ? stored.newInboxMessage
        : DEFAULTS.newInboxMessage,
    campaignCompleted:
      typeof stored.campaignCompleted === "boolean"
        ? stored.campaignCompleted
        : DEFAULTS.campaignCompleted,
    automationFailed:
      typeof stored.automationFailed === "boolean"
        ? stored.automationFailed
        : DEFAULTS.automationFailed,
    weeklyDigest:
      typeof stored.weeklyDigest === "boolean"
        ? stored.weeklyDigest
        : DEFAULTS.weeklyDigest,
  };

  return (
    <section>
      <SectionHeader
        title="Notifications"
        description="What you personally get notified about — each teammate sets their own."
      />
      <Card className="p-6">
        <NotificationsForm initial={prefs} />
      </Card>
      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-neutral-200 bg-neutral-50 p-3.5 text-sm text-neutral-600">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
        <p>
          Honest note: notifications are in-app only for now. Email and push
          delivery are on the roadmap — your preferences here will carry over.
        </p>
      </div>
    </section>
  );
}
