"use client";

import { useActionState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  disconnectPaymentConnectionAction,
  savePaymentConnectionAction,
  type PaymentActionResult,
} from "./payment-actions";

export function RazorpayConnectForm({ connected }: { connected: boolean }) {
  const [state, action, pending] = useActionState(
    async (_prev: PaymentActionResult | null, data: FormData) => savePaymentConnectionAction(data),
    null
  );
  const [disconnecting, startDisconnect] = useTransition();

  return (
    <div className="flex flex-col gap-3">
      <form action={action} className="flex flex-col gap-4">
        <Field label="Key ID" htmlFor="rzp-key-id" required hint="Razorpay → Account & Settings → API Keys. Starts with rzp_live_.">
          <Input id="rzp-key-id" name="keyId" required autoComplete="off" spellCheck={false} placeholder="rzp_live_…" />
        </Field>
        <Field label="Key Secret" htmlFor="rzp-key-secret" required hint="Shown once when you generate the key. Stored encrypted; never displayed again.">
          <Input id="rzp-key-secret" name="keySecret" type="password" required autoComplete="new-password" spellCheck={false} />
        </Field>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" loading={pending}>
            {connected ? "Replace keys" : "Connect Razorpay"}
          </Button>
          {connected && (
            <Button
              type="button"
              variant="ghost"
              loading={disconnecting}
              onClick={() => startDisconnect(async () => { await disconnectPaymentConnectionAction(); })}
            >
              Disconnect
            </Button>
          )}
        </div>
        {state && !pending && (
          <p
            role={state.ok ? "status" : "alert"}
            className={state.ok ? "rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800" : "rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800"}
          >
            {state.message}
          </p>
        )}
      </form>
    </div>
  );
}
