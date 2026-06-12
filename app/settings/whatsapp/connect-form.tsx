"use client";

import { useActionState } from "react";
import {
  connectWhatsappAction,
  type ActionResult,
} from "@/app/settings/whatsapp/actions";

const inputCls =
  "mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500";

export function ConnectForm() {
  const [result, action, pending] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) =>
      connectWhatsappAction(formData),
    null
  );

  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="text-sm font-medium text-neutral-700">
        Display name
        <input name="displayName" required className={inputCls} placeholder="Sharma Boutique" />
      </label>
      <label className="text-sm font-medium text-neutral-700">
        WABA ID
        <input name="wabaId" required className={inputCls + " font-mono"} placeholder="102290129340398" />
      </label>
      <label className="text-sm font-medium text-neutral-700">
        Phone number ID
        <input name="phoneNumberId" required className={inputCls + " font-mono"} placeholder="106540352242922" />
      </label>
      <label className="text-sm font-medium text-neutral-700">
        Access token
        <input
          name="accessToken"
          type="password"
          required
          className={inputCls + " font-mono"}
          placeholder="EAAG…"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save connection"}
      </button>
      {result && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            result.ok
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {result.message}
        </p>
      )}
    </form>
  );
}
