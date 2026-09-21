"use client";

import { useState } from "react";
import { FlaskConical, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  saveLlmAccountAction,
  disconnectLlmAccountAction,
  testLlmAccountAction,
} from "./actions";
import { BYOK_CATALOGUE } from "@/lib/model-router/guard";

// Rendered from the single BYOK catalogue — see lib/model-router/guard.ts.
// Duplicating the model ids here is what let gemini-3-pro ship broken.
const PROVIDERS = BYOK_CATALOGUE;

export function AiModelForm({
  connected,
}: {
  connected: { provider: string; model: string; hasKey: boolean } | null;
}) {
  const { toast } = useToast();
  const [provider, setProvider] = useState(connected?.provider ?? "anthropic");
  const [model, setModel] = useState(connected?.model ?? "claude-sonnet-5");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);

  const models = PROVIDERS.find((p) => p.id === provider)?.models ?? [];

  async function save() {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("provider", provider);
      fd.set("model", models.some((m) => m.id === model) ? model : models[0].id);
      fd.set("apiKey", apiKey);
      const res = await saveLlmAccountAction(fd);
      toast({ tone: res.ok ? "success" : "error", description: res.message });
      if (res.ok) setApiKey("");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    const res = await testLlmAccountAction();
    toast({ tone: res.ok ? "success" : "error", description: res.message });
  }

  async function disconnect() {
    const res = await disconnectLlmAccountAction();
    toast({ tone: res.ok ? "success" : "error", description: res.message });
  }

  return (
    <Card className="flex flex-col gap-4 p-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Provider">
          <select
            className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-2 text-sm"
            value={provider}
            onChange={(e) => {
              setProvider(e.target.value);
              const first = PROVIDERS.find((p) => p.id === e.target.value)?.models[0];
              if (first) setModel(first.id);
            }}
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Model">
          <select
            className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-2 text-sm"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field
        label="API key"
        hint={
          connected?.hasKey
            ? "A key is stored (encrypted). Leave blank to keep it; paste a new one to replace it."
            : "From your provider's console. Stored encrypted; never shown again."
        }
      >
        <Input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={connected?.hasKey ? "••••••••" : "sk-…"}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={save} loading={busy}>
          {connected ? "Save changes" : "Connect"}
        </Button>
        {connected && (
          <>
            <Button variant="secondary" onClick={test}>
              <FlaskConical className="h-4 w-4" aria-hidden />
              Test key
            </Button>
            <Button variant="ghost" onClick={disconnect}>
              <Unplug className="h-4 w-4 text-red-500" aria-hidden />
              Use Nudge&apos;s model
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}
