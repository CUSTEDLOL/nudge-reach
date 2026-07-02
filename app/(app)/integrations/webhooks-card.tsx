"use client";

import { useState } from "react";
import { Webhook, Plus, Trash2, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { CopyButton } from "./copy-button";
import {
  createWebhookEndpointAction,
  deleteWebhookEndpointAction,
  testWebhookEndpointAction,
  toggleWebhookEndpointAction,
} from "./actions";

export interface SerializedWebhook {
  id: string;
  url: string;
  events: string[];
  enabled: boolean;
  lastStatus: number | null;
  lastDeliveryAt: string | null;
}

export const WEBHOOK_EVENT_OPTIONS = [
  { value: "message.received", label: "Inbound message received" },
  { value: "message.sent", label: "Message sent" },
  { value: "campaign.completed", label: "Campaign completed" },
  { value: "contact.created", label: "Contact created" },
  { value: "conversation.assigned", label: "Conversation assigned" },
  { value: "automation.run", label: "Automation executed" },
];

export function WebhooksCard({
  webhooks,
  canManage,
}: {
  webhooks: SerializedWebhook[];
  canManage: boolean;
}) {
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function toggleEvent(value: string) {
    setEvents((prev) =>
      prev.includes(value) ? prev.filter((e) => e !== value) : [...prev, value]
    );
  }

  async function handleCreate() {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("url", url);
      events.forEach((e) => fd.append("events", e));
      const res = await createWebhookEndpointAction(fd);
      if (res.ok) {
        setAddOpen(false);
        setUrl("");
        setEvents([]);
        if (res.secret) setNewSecret(res.secret);
        toast({ tone: "success", description: res.message });
      } else {
        toast({ tone: "error", description: res.message });
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleToggle(id: string, enabled: boolean) {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("enabled", String(enabled));
    const res = await toggleWebhookEndpointAction(fd);
    toast({ tone: res.ok ? "success" : "error", description: res.message });
  }

  async function handleTest(id: string) {
    const fd = new FormData();
    fd.set("id", id);
    const res = await testWebhookEndpointAction(fd);
    toast({ tone: res.ok ? "success" : "error", description: res.message });
  }

  async function handleDelete() {
    if (!deleteId) return;
    const fd = new FormData();
    fd.set("id", deleteId);
    const res = await deleteWebhookEndpointAction(fd);
    toast({ tone: res.ok ? "success" : "error", description: res.message });
    setDeleteId(null);
  }

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <Webhook className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">
              Outbound webhooks
            </h2>
            <p className="mt-1 max-w-xl text-sm text-neutral-500">
              Send signed, real-time events to your own endpoints — or to Zapier,
              Make and n8n. Each payload carries an{" "}
              <code className="font-mono text-xs">X-Nudge-Signature</code> header
              (HMAC-SHA256) so you can verify it.
            </p>
          </div>
        </div>
        {canManage && (
          <Button variant="secondary" size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            Add webhook
          </Button>
        )}
      </div>

      {webhooks.length > 0 && (
        <ul className="mt-5 flex flex-col divide-y divide-neutral-100 rounded-xl border border-neutral-200">
          {webhooks.map((w) => (
            <li
              key={w.id}
              className="flex flex-wrap items-center justify-between gap-3 p-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <code className="min-w-0 break-all font-mono text-sm text-neutral-900">
                    {w.url}
                  </code>
                  {w.enabled ? (
                    <Badge tone="success">Active</Badge>
                  ) : (
                    <Badge tone="neutral">Paused</Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-neutral-500">
                  {w.events.length} event{w.events.length === 1 ? "" : "s"}
                  {w.lastDeliveryAt
                    ? ` · last delivery ${
                        w.lastStatus ? `HTTP ${w.lastStatus}` : "failed"
                      }`
                    : " · no deliveries yet"}
                </p>
              </div>
              {canManage && (
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleTest(w.id)}
                    title="Send a test event"
                  >
                    <Send className="h-4 w-4" aria-hidden />
                    Test
                  </Button>
                  <Switch
                    checked={w.enabled}
                    onCheckedChange={(v) => handleToggle(w.id, v)}
                    aria-label={w.enabled ? "Pause webhook" : "Enable webhook"}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteId(w.id)}
                    aria-label="Delete webhook"
                  >
                    <Trash2 className="h-4 w-4 text-red-500" aria-hidden />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {webhooks.length === 0 && (
        <p className="mt-5 rounded-xl border border-dashed border-neutral-200 p-4 text-sm text-neutral-500">
          No webhooks yet. Add one to forward inbox and campaign events to your
          own tools.
        </p>
      )}

      {/* Add modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add a webhook"
        description="We'll POST a signed JSON payload to this URL when the events you pick fire."
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              loading={busy}
              disabled={!url.trim() || events.length === 0}
            >
              Add webhook
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Endpoint URL" htmlFor="wh-url">
            <Input
              id="wh-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://hooks.zapier.com/…"
              inputMode="url"
            />
          </Field>
          <div>
            <p className="mb-2 text-sm font-medium text-neutral-700">Events</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {WEBHOOK_EVENT_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-sm hover:bg-neutral-50"
                >
                  <input
                    type="checkbox"
                    checked={events.includes(opt.value)}
                    onChange={() => toggleEvent(opt.value)}
                    className="h-4 w-4 accent-brand-600"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Secret shown once after create */}
      <Modal
        open={newSecret !== null}
        onClose={() => setNewSecret(null)}
        title="Copy your signing secret"
        description="You won't see this again. Use it to verify the X-Nudge-Signature header on incoming events."
        footer={
          <Button onClick={() => setNewSecret(null)}>Done</Button>
        }
      >
        <div className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
          <code className="min-w-0 break-all font-mono text-sm text-neutral-900">
            {newSecret}
          </code>
          {newSecret && <CopyButton value={newSecret} label="Copy secret" />}
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete this webhook?"
        description="Events will stop being delivered to this endpoint immediately."
        confirmLabel="Delete"
        tone="danger"
      />
    </Card>
  );
}
