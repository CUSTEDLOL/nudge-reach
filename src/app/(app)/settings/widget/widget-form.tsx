"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { CopyButton } from "../../integrations/copy-button";
import { saveWidgetAction } from "./actions";

export function WidgetForm({
  initial,
  appOrigin,
}: {
  initial: {
    enabled: boolean;
    phoneE164: string;
    prefill: string;
    position: string;
    color: string;
    widgetKey: string;
  };
  appOrigin: string;
}) {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [phone, setPhone] = useState(initial.phoneE164);
  const [prefill, setPrefill] = useState(initial.prefill);
  const [position, setPosition] = useState(initial.position);
  const [color, setColor] = useState(initial.color);
  const [busy, setBusy] = useState(false);

  const snippet = initial.widgetKey
    ? `<script src="${appOrigin}/widget.js" data-nudge-key="${initial.widgetKey}" async></script>`
    : null;

  async function save() {
    setBusy(true);
    try {
      const fd = new FormData();
      if (enabled) fd.set("enabled", "on");
      fd.set("phone", phone);
      fd.set("prefill", prefill);
      fd.set("position", position);
      fd.set("color", color);
      const res = await saveWidgetAction(fd);
      toast({ tone: res.ok ? "success" : "error", description: res.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4 p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-neutral-900">Show the button</p>
            <p className="text-sm text-neutral-500">
              Off = the snippet stays on your site but renders nothing.
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Enable widget" />
        </div>
        <Field
          label="WhatsApp number the button opens"
          hint="Your public business number — visitors land in this WhatsApp chat."
        >
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
        </Field>
        <Field label="Pre-filled message" hint="What the visitor's message starts with.">
          <Input value={prefill} onChange={(e) => setPrefill(e.target.value)} maxLength={200} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Corner">
            <select
              className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-2 text-sm"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
            >
              <option value="right">Bottom right</option>
              <option value="left">Bottom left</option>
            </select>
          </Field>
          <Field label="Button color">
            <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 p-1" />
          </Field>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={save} loading={busy}>
            Save widget
          </Button>
          {/* Live preview of the button, exactly as the script renders it. */}
          <span
            className="flex h-12 w-12 items-center justify-center rounded-full shadow-md"
            style={{ backgroundColor: color }}
            aria-hidden
          >
            <MessageCircle className="h-6 w-6 text-white" />
          </span>
          <span className="text-xs text-neutral-400">preview</span>
        </div>
      </Card>

      {snippet && (
        <Card className="p-6">
          <p className="text-sm font-semibold text-neutral-900">Add it to your website</p>
          <p className="mt-1 text-sm text-neutral-500">
            Paste this once before <code className="font-mono text-xs">&lt;/body&gt;</code> on
            any site — WordPress, Shopify, Wix, custom. Clicks show up in your analytics.
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
            <code className="min-w-0 break-all font-mono text-xs text-neutral-900">{snippet}</code>
            <CopyButton value={snippet} label="Copy snippet" />
          </div>
        </Card>
      )}
    </div>
  );
}
