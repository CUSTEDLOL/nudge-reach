"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  confirmCheckoutAction,
  confirmCreditCheckoutAction,
  startCheckoutAction,
  startCreditCheckoutAction,
} from "./actions";

/**
 * One-time checkout button for a plan month or a credit pack. Loads the
 * Razorpay widget script on demand, starts the checkout server-side, then
 * either redirects to hosted Stripe Checkout (non-INR) or opens the widget
 * and confirms server-side (INR). Only rendered when the org's gateway is
 * configured and the viewer can manage billing.
 */
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
    };
  }
}

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function CheckoutButton({
  kind,
  id,
  label,
  orgName,
}: {
  kind: "plan" | "credits";
  /** planId or credit pack id. */
  id: string;
  label: string;
  orgName: string;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function pay() {
    setBusy(true);
    try {
      const ok = await loadRazorpay();
      if (!ok) {
        toast({ tone: "error", description: "Couldn't load the payment widget." });
        return;
      }
      const fd = new FormData();
      fd.set("planId", id);
      const res =
        kind === "plan" ? await startCheckoutAction(fd) : await startCreditCheckoutAction(id);
      if (!res.ok) {
        toast({ tone: "error", description: res.message });
        return;
      }
      // Non-INR orgs: hosted Stripe Checkout — leave the app.
      if (res.redirectUrl) {
        window.location.assign(res.redirectUrl);
        return;
      }
      if (!res.checkout) {
        toast({ tone: "error", description: res.message });
        return;
      }
      const c = res.checkout;
      const rzp = new window.Razorpay!({
        key: c.keyId,
        order_id: c.orderId,
        amount: c.amount,
        currency: c.currency,
        name: orgName,
        description: c.description,
        handler: async (r: Record<string, string>) => {
          const confirm = new FormData();
          confirm.set("razorpay_order_id", r.razorpay_order_id);
          confirm.set("razorpay_payment_id", r.razorpay_payment_id);
          confirm.set("razorpay_signature", r.razorpay_signature);
          const result =
            kind === "plan"
              ? await confirmCheckoutAction(confirm)
              : await confirmCreditCheckoutAction(confirm);
          toast({
            tone: result.ok ? "success" : "error",
            description: result.message,
          });
          if (result.ok) router.refresh();
        },
      });
      rzp.open();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="sm" className="w-full" loading={busy} onClick={pay}>
      {label}
    </Button>
  );
}
