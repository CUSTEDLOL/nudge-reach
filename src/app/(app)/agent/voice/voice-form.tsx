"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import {
  removeVoiceNumberAction,
  saveVoiceNumberAction,
  simulateCallAction,
  toggleReminderCallsAction,
  type ActionResult,
} from "./actions";

export interface VoiceNumberRow {
  id: string;
  phoneE164: string;
  provider: string;
  label: string;
  transferTo: string | null;
  language: string;
  enabled: boolean;
}

export function VoiceNumberForm() {
  const { toast } = useToast();
  const [, formAction, pending] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) => {
      const result = await saveVoiceNumberAction(formData);
      toast({ description: result.message, tone: result.ok ? "success" : "error" });
      return result;
    },
    null
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone number" htmlFor="voice-phone" required hint="The number customers dial, with country code.">
          <Input id="voice-phone" name="phoneE164" required className="font-mono" placeholder="+91 80000 00001" />
        </Field>
        <Field label="Label" htmlFor="voice-label">
          <Input id="voice-label" name="label" placeholder="Main line" />
        </Field>
        <Field label="Carrier" htmlFor="voice-provider" required>
          <Select id="voice-provider" name="provider" defaultValue="exotel">
            <option value="exotel">Exotel (India)</option>
            <option value="twilio">Twilio (SG / MY / UAE)</option>
            <option value="sim">Test mode only</option>
          </Select>
        </Field>
        <Field label="Language" htmlFor="voice-language">
          <Select id="voice-language" name="language" defaultValue="en">
            <option value="en">English</option>
            <option value="hi">Hindi / Hinglish</option>
          </Select>
        </Field>
        <Field label="Transfer calls to" htmlFor="voice-transfer" hint="A person's number for hand-offs.">
          <Input id="voice-transfer" name="transferTo" className="font-mono" placeholder="+91 98000 00000" />
        </Field>
        <Field label="ElevenLabs phone id" htmlFor="voice-eleven" hint="From ElevenLabs → Phone numbers, after importing this number.">
          <Input id="voice-eleven" name="elevenPhoneId" className="font-mono" placeholder="phnum_…" />
        </Field>
        <Field label="Voice id" htmlFor="voice-voice" hint="Optional ElevenLabs voice; blank = default.">
          <Input id="voice-voice" name="voiceId" className="font-mono" />
        </Field>
      </div>
      <div>
        <Button type="submit" loading={pending}>
          Save number
        </Button>
      </div>
    </form>
  );
}

export function VoiceNumberList({ numbers }: { numbers: VoiceNumberRow[] }) {
  const { toast } = useToast();
  if (!numbers.length) {
    return <p className="text-sm text-neutral-500">No number yet — add one below.</p>;
  }
  return (
    <ul className="divide-y divide-neutral-100">
      {numbers.map((n) => (
        <li key={n.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div>
            <p className="text-sm font-semibold text-neutral-900">
              {n.label} <span className="ml-2 font-mono text-xs text-neutral-500">{n.phoneE164}</span>
            </p>
            <p className="text-xs text-neutral-500">
              {n.provider} · {n.language === "hi" ? "Hindi" : "English"}
              {n.transferTo ? ` · transfers to ${n.transferTo}` : " · no transfer number"}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={async () => {
              const r = await removeVoiceNumberAction(n.id);
              toast({ description: r.message, tone: r.ok ? "success" : "error" });
            }}
          >
            Remove
          </Button>
        </li>
      ))}
    </ul>
  );
}

export function ReminderCallsToggle({ enabled }: { enabled: boolean }) {
  const { toast } = useToast();
  const [on, setOn] = useState(enabled);
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-neutral-900">Call customers 2 hours before their booking</p>
        <p className="text-xs text-neutral-500">
          Confirmed bookings only, 9am–8pm local time, never to anyone who opted out. WhatsApp reminders stay on.
        </p>
      </div>
      <Switch
        checked={on}
        aria-label="Reminder calls"
        onCheckedChange={async (next) => {
          setOn(next);
          const r = await toggleReminderCallsAction(next);
          toast({ description: r.message, tone: r.ok ? "success" : "error" });
          if (!r.ok) setOn(!next);
        }}
      />
    </div>
  );
}

export function SimulateCallButton() {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      type="button"
      variant="secondary"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        const r = await simulateCallAction();
        setBusy(false);
        toast({ description: r.message, tone: r.ok ? "success" : "error" });
      }}
    >
      Simulate a call
    </Button>
  );
}
