"use client";

import { useActionState } from "react";
import {
  saveAgentProfileAction,
  type ActionResult,
} from "./actions";

const inputCls =
  "mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500";

export interface AgentFormValues {
  enabled: boolean;
  vertical: string;
  businessName: string;
  businessInfo: string;
  tone: string;
  doNots: string;
}

export function AgentForm({ initial }: { initial: AgentFormValues }) {
  const [result, action, pending] = useActionState(
    async (_p: ActionResult | null, fd: FormData) => saveAgentProfileAction(fd),
    null
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm">
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={initial.enabled}
          className="mt-0.5"
        />
        <span>
          <strong>Auto-reply is on.</strong> When a customer messages your
          WhatsApp, the assistant answers instantly using the info below. Turn
          off to handle messages yourself.
        </span>
      </label>

      <label className="text-sm font-medium text-neutral-700">
        Business type
        <select name="vertical" defaultValue={initial.vertical} className={inputCls}>
          <option value="restaurant">Restaurant</option>
          <option value="retail">Shop / Retail</option>
          <option value="clinic">Clinic / Salon</option>
          <option value="real_estate">Real estate</option>
        </select>
      </label>

      <label className="text-sm font-medium text-neutral-700">
        Business name
        <input name="businessName" defaultValue={initial.businessName} className={inputCls} placeholder="Spice Garden" />
      </label>

      <label className="text-sm font-medium text-neutral-700">
        What should the assistant know?{" "}
        <span className="font-normal text-neutral-400">
          (hours, address, menu/prices, booking policy — the more, the better)
        </span>
        <textarea
          name="businessInfo"
          rows={8}
          defaultValue={initial.businessInfo}
          className={inputCls}
          placeholder={"Open Tue–Sun, 12pm–11pm. Closed Mondays.\nAddress: 14 MG Road, Bengaluru.\nVeg & non-veg North Indian. Popular: Paneer Tikka ₹280, Butter Chicken ₹360.\nReservations for 6+ only; we'll confirm by call.\nWe do takeaway and Swiggy/Zomato delivery."}
        />
      </label>

      <label className="text-sm font-medium text-neutral-700">
        Tone
        <input name="tone" defaultValue={initial.tone} className={inputCls} placeholder="Warm, friendly, and concise" />
      </label>

      <label className="text-sm font-medium text-neutral-700">
        Anything to avoid?{" "}
        <span className="font-normal text-neutral-400">(optional)</span>
        <input name="doNots" defaultValue={initial.doNots} className={inputCls} placeholder="Don't quote delivery times; don't discuss competitors" />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save assistant"}
      </button>

      {result && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            result.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
          }`}
        >
          {result.message}
        </p>
      )}
    </form>
  );
}
