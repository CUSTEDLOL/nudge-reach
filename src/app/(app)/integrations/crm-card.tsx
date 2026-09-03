"use client";

import { useTransition } from "react";
import { Database } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { formatRelativeTime } from "@/modules/inbox/format";
import type { CrmProviderKey } from "@/modules/crm/types";
import type { CrmCardModel } from "./crm-card-model";
import { disconnectCrmAction, syncCrmNowAction } from "./crm-actions";

const EVENT_LABEL: Record<string, string> = {
  "contact.created": "New lead",
  "lead.qualified": "Marked qualified",
  "booking.created": "Appointment",
  "payment.paid": "Payment note",
  "handoff.requested": "Hand-off task",
  "conversation.summary": "Summary note",
};

export function CrmCard({ model, canManage }: { model: CrmCardModel; canManage: boolean }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();

  const run = (action: () => Promise<{ ok: boolean; message: string }>) =>
    start(async () => {
      const r = await action();
      toast({ title: "CRM", description: r.message, tone: r.ok ? "success" : "error" });
    });

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <Database className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-base font-semibold text-neutral-900">CRM</h2>
            <p className="mt-1 max-w-xl text-sm text-neutral-500">
              Every lead, booking, payment and hand-off the AI handles is written into your CRM automatically.
              Your CRM stays the place your team works.
            </p>
            {model.simulated && (
              <p className="mt-2 text-xs text-neutral-500">
                Test mode — connections are simulated; jobs still flow so you can see what will be written.
              </p>
            )}
          </div>
        </div>
        {canManage && (
          <Button variant="secondary" loading={pending} onClick={() => run(syncCrmNowAction)}>
            Sync now{model.pendingCount ? ` (${model.pendingCount} waiting)` : ""}
          </Button>
        )}
      </div>

      <ul className="mt-5 divide-y divide-neutral-100 rounded-xl border border-neutral-200">
        {model.providers.map((p) => (
          <li key={p.key} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-3">
              <Badge tone={p.connected ? "success" : "neutral"}>{p.connected ? "Connected" : "Not connected"}</Badge>
              <div>
                <p className="text-sm font-medium text-neutral-900">{p.label}</p>
                <p className="text-xs text-neutral-500">
                  {p.connected
                    ? `${p.accountLabel}${p.lastSyncAt ? ` · last sync ${formatRelativeTime(p.lastSyncAt)}` : ""}`
                    : "Leads, appointments and payments will appear here once connected."}
                  {p.lastError && <span className="text-red-600"> · {p.lastError}</span>}
                </p>
              </div>
            </div>
            {canManage &&
              (p.connected ? (
                <Button
                  variant="ghost"
                  loading={pending}
                  onClick={() => run(() => disconnectCrmAction(p.key as CrmProviderKey))}
                >
                  Disconnect
                </Button>
              ) : (
                <a
                  href={`/api/integrations/crm/${p.key}/start${p.key === "zoho" ? "?dc=in" : ""}`}
                  className={buttonVariants({ variant: "secondary" })}
                >
                  Connect {p.label}
                </a>
              ))}
          </li>
        ))}
      </ul>

      {model.recent.length > 0 && (
        <div className="mt-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Recent sync</h3>
          <ul className="mt-2 divide-y divide-neutral-100 text-sm">
            {model.recent.map((j, i) => (
              <li key={`${j.event}-${j.when}-${i}`} className="flex items-center justify-between gap-3 py-2">
                <span className="text-neutral-900">{EVENT_LABEL[j.event] ?? j.event}</span>
                <span className="flex items-center gap-2 text-xs text-neutral-500">
                  {j.error && <span className="max-w-[16rem] truncate text-red-600">{j.error}</span>}
                  <Badge tone={j.status === "done" ? "success" : j.status === "dead" ? "warning" : "info"}>
                    {j.status}
                  </Badge>
                  <span suppressHydrationWarning>{formatRelativeTime(j.when)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
