"use client";

import { useState } from "react";
import { Plus, Trash2, FlaskConical, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import {
  createCustomActionAction,
  updateCustomActionAction,
  toggleCustomActionAction,
  deleteCustomActionAction,
  testCustomActionAction,
} from "./actions";

export interface SerializedCustomAction {
  id: string;
  name: string;
  description: string;
  url: string;
  method: string;
  timeoutMs: number;
  enabled: boolean;
  hasSecret: boolean;
  inputSchema: string; // pretty-printed JSON
}

const EMPTY = {
  id: "",
  name: "",
  description: "",
  url: "",
  method: "POST",
  timeoutMs: 8000,
  enabled: true,
  hasSecret: false,
  inputSchema: `{
  "type": "object",
  "properties": {
    "order_id": { "type": "string", "description": "The customer's order number" }
  },
  "required": ["order_id"]
}`,
};

export function CustomActionsCard({ actions }: { actions: SerializedCustomAction[] }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState<SerializedCustomAction | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [secret, setSecret] = useState("");
  const isNew = !form.id;

  function openNew() {
    setForm(EMPTY);
    setSecret("");
    setEditing({ ...EMPTY });
  }
  function openEdit(a: SerializedCustomAction) {
    setForm(a);
    setSecret("");
    setEditing(a);
  }

  async function save() {
    setBusy(true);
    try {
      const fd = new FormData();
      for (const [k, v] of Object.entries({
        id: form.id,
        name: form.name,
        description: form.description,
        url: form.url,
        method: form.method,
        timeoutMs: String(form.timeoutMs),
        inputSchema: form.inputSchema,
        secret,
      })) {
        fd.set(k, v);
      }
      const res = isNew
        ? await createCustomActionAction(fd)
        : await updateCustomActionAction(fd);
      toast({ tone: res.ok ? "success" : "error", description: res.message });
      if (res.ok) setEditing(null);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(id: string, enabled: boolean) {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("enabled", String(enabled));
    const res = await toggleCustomActionAction(fd);
    toast({ tone: res.ok ? "success" : "error", description: res.message });
  }

  async function runTest(id: string) {
    setTestOutput(null);
    const fd = new FormData();
    fd.set("id", id);
    const res = await testCustomActionAction(fd);
    toast({ tone: res.ok ? "success" : "error", description: res.message });
    if (res.output) setTestOutput(res.output);
  }

  async function remove() {
    if (!deleteId) return;
    const fd = new FormData();
    fd.set("id", deleteId);
    const res = await deleteCustomActionAction(fd);
    toast({ tone: res.ok ? "success" : "error", description: res.message });
    setDeleteId(null);
  }

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <Zap className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">Connected actions</h2>
            <p className="mt-1 max-w-xl text-sm text-neutral-500">
              Each action points at your own system&apos;s API. Mid-conversation, the
              agent fills in the fields you define, calls your endpoint, and answers
              the customer with the live result.
            </p>
          </div>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Add action
        </Button>
      </div>

      {actions.length > 0 ? (
        <ul className="mt-5 flex flex-col divide-y divide-neutral-100 rounded-xl border border-neutral-200">
          {actions.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(a)}
                    className="font-mono text-sm text-neutral-900 underline-offset-2 hover:underline"
                  >
                    {a.name}
                  </button>
                  {a.enabled ? (
                    <Badge tone="success">Active</Badge>
                  ) : (
                    <Badge tone="neutral">Paused</Badge>
                  )}
                </div>
                <p className="mt-1 max-w-xl truncate text-xs text-neutral-500">
                  {a.method} {a.url}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => runTest(a.id)} title="Run once with empty input">
                  <FlaskConical className="h-4 w-4" aria-hidden />
                  Test
                </Button>
                <Switch
                  checked={a.enabled}
                  onCheckedChange={(v) => toggle(a.id, v)}
                  aria-label={a.enabled ? "Pause action" : "Enable action"}
                />
                <Button variant="ghost" size="sm" onClick={() => setDeleteId(a.id)} aria-label="Delete action">
                  <Trash2 className="h-4 w-4 text-red-500" aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 rounded-xl border border-dashed border-neutral-200 p-4 text-sm text-neutral-500">
          No actions yet. Add one — e.g. <span className="font-mono">check_order_status</span>{" "}
          pointing at your order system — and your agent starts using it immediately.
        </p>
      )}

      {testOutput && (
        <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Last test output</p>
          <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs text-neutral-700">
            {testOutput}
          </pre>
        </div>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={isNew ? "Add an action" : `Edit ${form.name}`}
        description="The AI reads the name, description and fields to decide when and how to call it."
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={save} loading={busy} disabled={!form.name || !form.url || !form.description}>
              {isNew ? "Add action" : "Save changes"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label="Name (what the AI calls it)" hint="lowercase_with_underscores">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="check_order_status"
            />
          </Field>
          <Field
            label="Description (when should the AI use this?)"
            hint="e.g. “Look up the live status of a customer's order by its order number.”"
          >
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Look up the status of a customer's order by order id."
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Method">
              <select
                className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-2 text-sm"
                value={form.method}
                onChange={(e) => setForm({ ...form, method: e.target.value })}
              >
                <option value="POST">POST</option>
                <option value="GET">GET</option>
              </select>
            </Field>
            <Field label="Endpoint URL" className="col-span-2">
              <Input
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://api.yourbusiness.com/orders/status"
              />
            </Field>
          </div>
          <Field
            label="API secret (optional)"
            hint={form.hasSecret && !secret ? "A secret is stored — leave blank to keep it." : "Sent as a Bearer token + used to sign requests."}
          >
            <Input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder={form.hasSecret ? "••••••••" : "sk-…"}
            />
          </Field>
          <Field label="Input fields (JSON schema)" hint="The fields the AI must collect from the customer before calling.">
            <textarea
              className="min-h-28 w-full rounded-lg border border-neutral-200 bg-white p-2 font-mono text-xs"
              value={form.inputSchema}
              onChange={(e) => setForm({ ...form, inputSchema: e.target.value })}
            />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={remove}
        title="Remove this action?"
        description="The agent stops using it immediately. This can't be undone."
        confirmLabel="Remove"
      />
    </Card>
  );
}
