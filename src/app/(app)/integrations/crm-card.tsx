"use client";

import { useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
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

/** Renders inside the integrations drawer, which already carries the "CRM sync"
 *  title and its one-line description — so this starts at the providers. */
export function CrmCard({ model, canManage }: { model: CrmCardModel; canManage: boolean }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();

  const run = (action: () => Promise<{ ok: boolean; message: string }>) =>
    start(async () => {
      const r = await action();
      toast({ title: "CRM", description: r.message, tone: r.ok ? "success" : "error" });
    });

  const anyConnected = model.providers.some((p) => p.connected);

  return (
    <div className="space-y-5">
      {model.simulated && (
        <p className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
          <Badge tone="info">Test mode</Badge>
          Connections are simulated — jobs still flow, so you can see what will be
          written.
        </p>
      )}

      <div>
        <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200">
          {model.providers.map((p) => (
            <li
              key={p.key}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-neutral-900">{p.label}</p>
                  {p.connected && <Badge tone="success">Connected</Badge>}
                </div>
                {(p.connected || p.lastError) && (
                  <p className="mt-0.5 truncate text-xs text-neutral-500">
                    {p.connected && p.accountLabel}
                    {p.connected && p.lastSyncAt && (
                      <>
                        {p.accountLabel && " · "}last sync{" "}
                        <span suppressHydrationWarning>
                          {formatRelativeTime(p.lastSyncAt)}
                        </span>
                      </>
                    )}
                    {p.lastError && (
                      <span className="text-red-600">
                        {p.connected && " · "}
                        {p.lastError}
                      </span>
                    )}
                  </p>
                )}
              </div>
              {canManage &&
                (p.connected ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={pending}
                    onClick={() => run(() => disconnectCrmAction(p.key as CrmProviderKey))}
                  >
                    Disconnect
                  </Button>
                ) : p.available ? (
                  <a
                    href={`/api/integrations/crm/${p.key}/start${p.key === "zoho" ? "?dc=in" : ""}`}
                    className={buttonVariants({ variant: "secondary", size: "sm" })}
                  >
                    Connect
                  </a>
                ) : (
                  // No platform keys for this provider: the start route refuses
                  // for live workspaces, so never offer a link that dead-ends.
                  <p className="max-w-[16rem] text-right text-xs leading-relaxed text-neutral-500">
                    Not switched on yet. We&apos;re finishing the {p.label} setup
                    on our side and will let you know.
                  </p>
                ))}
            </li>
          ))}
        </ul>
        {!anyConnected && (
          <p className="mt-2 text-xs text-neutral-500">
            Connect one and every lead, booking, payment and hand-off the AI
            handles lands in it automatically — your CRM stays the place your team
            works.
          </p>
        )}
      </div>

      {model.recent.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Recent sync
          </h3>
          <ul className="mt-2 divide-y divide-neutral-100 text-sm">
            {model.recent.map((j, i) => (
              <li
                key={`${j.event}-${j.when}-${i}`}
                className="flex items-center justify-between gap-3 py-2"
              >
                <span className="text-neutral-900">{EVENT_LABEL[j.event] ?? j.event}</span>
                <span className="flex items-center gap-2 text-xs text-neutral-500">
                  {j.error && (
                    <span className="max-w-[16rem] truncate text-red-600">{j.error}</span>
                  )}
                  <Badge tone={j.status === "done" ? "success" : j.status === "dead" ? "warning" : "info"}>
                    {j.status}
                  </Badge>
                  <span suppressHydrationWarning>{formatRelativeTime(j.when)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {canManage && (anyConnected || model.pendingCount > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-4">
          <span className="text-xs text-neutral-500">
            {model.pendingCount
              ? `${model.pendingCount} waiting to sync`
              : "Everything synced"}
          </span>
          <Button
            variant="secondary"
            size="sm"
            loading={pending}
            onClick={() => run(syncCrmNowAction)}
          >
            Sync now
          </Button>
        </div>
      )}
    </div>
  );
}
