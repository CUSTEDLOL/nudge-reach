"use client";

import { useActionState, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { saveAgentProfileAction, type ActionResult } from "./setup-actions";

export interface AgentFormValues {
  enabled: boolean;
  vertical: string;
  businessName: string;
  businessInfo: string;
  tone: string;
  doNots: string;
}

export function AgentForm({ initial }: { initial: AgentFormValues }) {
  const { toast } = useToast();
  const enabledLabelId = useId();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [, formAction, pending] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) => {
      const result = await saveAgentProfileAction(formData);
      toast({
        description: result.message,
        tone: result.ok ? "success" : "error",
      });
      return result;
    },
    null
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
        <div>
          <p
            id={enabledLabelId}
            className="text-sm font-medium text-neutral-900"
          >
            Auto-reply {enabled ? "is on" : "is off"}
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">
            When on, the assistant answers new customer messages instantly
            using the info below. Turn off to handle messages yourself.
          </p>
        </div>
        <Switch
          name="enabled"
          checked={enabled}
          onCheckedChange={setEnabled}
          aria-labelledby={enabledLabelId}
        />
      </div>

      <Field label="Business type" htmlFor="agent-vertical">
        <Select
          id="agent-vertical"
          name="vertical"
          defaultValue={initial.vertical}
        >
          <option value="restaurant">Restaurant</option>
          <option value="retail">Shop / Retail</option>
          <option value="clinic">Clinic / Salon</option>
          <option value="real_estate">Real estate</option>
        </Select>
      </Field>

      <Field label="Business name" htmlFor="agent-business-name" required>
        <Input
          id="agent-business-name"
          name="businessName"
          defaultValue={initial.businessName}
          placeholder="Spice Garden"
        />
      </Field>

      <Field
        label="What should the assistant know?"
        htmlFor="agent-business-info"
        hint="Hours, address, menu/prices, booking policy — the more, the better."
      >
        <Textarea
          id="agent-business-info"
          name="businessInfo"
          rows={8}
          defaultValue={initial.businessInfo}
          placeholder={
            "Open Tue–Sun, 12pm–11pm. Closed Mondays.\nAddress: 14 MG Road, Bengaluru.\nVeg & non-veg North Indian. Popular: Paneer Tikka ₹280, Butter Chicken ₹360.\nReservations for 6+ only; we'll confirm by call.\nWe do takeaway and Swiggy/Zomato delivery."
          }
        />
      </Field>

      <Field label="Tone" htmlFor="agent-tone">
        <Input
          id="agent-tone"
          name="tone"
          defaultValue={initial.tone}
          placeholder="Warm, friendly, and concise"
        />
      </Field>

      <Field
        label="Anything to avoid?"
        htmlFor="agent-do-nots"
        hint="Optional guardrails for the assistant."
      >
        <Input
          id="agent-do-nots"
          name="doNots"
          defaultValue={initial.doNots}
          placeholder="Don't quote delivery times; don't discuss competitors"
        />
      </Field>

      <div>
        <Button type="submit" loading={pending}>
          Save assistant
        </Button>
      </div>
    </form>
  );
}
