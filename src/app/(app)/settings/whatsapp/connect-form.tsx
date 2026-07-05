"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { connectWhatsappAction, type ActionResult } from "./actions";

export function ConnectForm() {
  const { toast } = useToast();
  const [, formAction, pending] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) => {
      const result = await connectWhatsappAction(formData);
      toast({
        description: result.message,
        tone: result.ok ? "success" : "error",
      });
      return result;
    },
    null
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="Display name" htmlFor="wa-display-name" required>
        <Input
          id="wa-display-name"
          name="displayName"
          required
          placeholder="Sharma Boutique"
        />
      </Field>

      <Field label="WABA ID" htmlFor="wa-waba-id" required>
        <Input
          id="wa-waba-id"
          name="wabaId"
          required
          className="font-mono"
          placeholder="102290129340398"
        />
      </Field>

      <Field label="Phone number ID" htmlFor="wa-phone-number-id" required>
        <Input
          id="wa-phone-number-id"
          name="phoneNumberId"
          required
          className="font-mono"
          placeholder="106540352242922"
        />
      </Field>

      <Field
        label="Access token"
        htmlFor="wa-access-token"
        required
        hint="Stored encrypted at rest (AES-256-GCM) — never shown again."
      >
        <Input
          id="wa-access-token"
          name="accessToken"
          type="password"
          required
          className="font-mono"
          placeholder="EAAG…"
        />
      </Field>

      <div>
        <Button type="submit" loading={pending}>
          Save connection
        </Button>
      </div>
    </form>
  );
}
