"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { saveMetaAppAction } from "./meta-app-actions";

export function MetaAppForm({ appId }: { appId?: string }) {
  const [state, action, pending] = useActionState(async (_previous: { ok: boolean; message: string } | null, data: FormData) => saveMetaAppAction(data), null);
  return <form action={action} className="flex flex-col gap-4">
    <Field label="Meta App ID" htmlFor="meta-app-id" required>
      <Input id="meta-app-id" name="appId" defaultValue={appId} required inputMode="numeric" autoComplete="off" />
    </Field>
    <Field label="Meta App Secret" htmlFor="meta-app-secret" required hint="From Meta → App settings → Basic. Stored encrypted; never displayed again.">
      <Input id="meta-app-secret" name="appSecret" type="password" required autoComplete="new-password" minLength={32} maxLength={32} />
    </Field>
    {appId && <p className="text-sm text-neutral-500">Saving replaces the app secret and verification token. Verify the webhook in Meta again afterward.</p>}
    <div><Button type="submit" loading={pending}>Save Meta app</Button></div>
    {state && <p role={state.ok ? "status" : "alert"} className={state.ok ? "text-sm text-emerald-700" : "text-sm text-red-700"}>{state.message}</p>}
  </form>;
}
