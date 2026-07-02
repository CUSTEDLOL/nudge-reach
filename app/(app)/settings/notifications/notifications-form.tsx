"use client";

import { useActionState, useId } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { saveNotificationPrefsAction, type ActionResult } from "./actions";

export interface NotificationPrefs {
  newInboxMessage: boolean;
  campaignCompleted: boolean;
  automationFailed: boolean;
  weeklyDigest: boolean;
}

const ROWS: {
  key: keyof NotificationPrefs;
  label: string;
  description: string;
}[] = [
  {
    key: "newInboxMessage",
    label: "New inbox message",
    description: "A customer sends a new WhatsApp message to your workspace.",
  },
  {
    key: "campaignCompleted",
    label: "Campaign completed",
    description: "A broadcast finishes sending, with its delivery summary.",
  },
  {
    key: "automationFailed",
    label: "Automation failed",
    description: "An automation run errors out and needs a human look.",
  },
  {
    key: "weeklyDigest",
    label: "Weekly digest",
    description: "A Monday summary of messages, campaigns and new contacts.",
  },
];

export function NotificationsForm({
  initial,
}: {
  initial: NotificationPrefs;
}) {
  const { toast } = useToast();
  const idBase = useId();
  const [, formAction, pending] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) => {
      const result = await saveNotificationPrefsAction(formData);
      toast({
        description: result.message,
        tone: result.ok ? "success" : "error",
      });
      return result;
    },
    null
  );

  return (
    <form action={formAction} className="flex flex-col gap-1">
      {ROWS.map(({ key, label, description }, index) => {
        const labelId = `${idBase}-${key}`;
        return (
          <div
            key={key}
            className={
              "flex items-start justify-between gap-4 py-3.5" +
              (index > 0 ? " border-t border-neutral-100" : "")
            }
          >
            <div>
              <p id={labelId} className="text-sm font-medium text-neutral-900">
                {label}
              </p>
              <p className="mt-0.5 text-xs text-neutral-500">{description}</p>
            </div>
            <Switch
              name={key}
              defaultChecked={initial[key]}
              aria-labelledby={labelId}
              className="mt-0.5"
            />
          </div>
        );
      })}
      <div className="mt-3">
        <Button type="submit" loading={pending}>
          Save preferences
        </Button>
      </div>
    </form>
  );
}
