"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { startCheckoutAction, confirmCheckoutAction } from "./actions";

/**
 * Razorpay Checkout button. Loads the widget script on demand, creates an order
 * server-side, opens the hosted widget, then confirms server-side. Only
 * rendered when Razorpay is configured and the viewer can manage billing.
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

export function PlanCheckout({
  planId,
  planName,
  current,
  orgName,
}: {
  planId: string;
  planName: string;
  current: boolean;
  orgName: string;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function upgrade() {
    setBusy(true);
    try {
      const ok = await loadRazorpay();
      if (!ok) {
        toast({ tone: "error", description: "Couldn't load the payment widget." });
        return;
      }
      const fd = new FormData();
      fd.set("planId", planId);
      const res = await startCheckoutAction(fd);
      if (!res.ok || !res.checkout) {
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
        description: `${c.planName} plan`,
        handler: async (r: Record<string, string>) => {
          const confirm = new FormData();
          confirm.set("planId", planId);
          confirm.set("razorpay_order_id", r.razorpay_order_id);
          confirm.set("razorpay_payment_id", r.razorpay_payment_id);
          confirm.set("razorpay_signature", r.razorpay_signature);
          const result = await confirmCheckoutAction(confirm);
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

  if (current) {
    return (
      <Button variant="secondary" size="sm" disabled className="w-full">
        Current plan
      </Button>
    );
  }

  return (
    <Button size="sm" className="w-full" loading={busy} onClick={upgrade}>
      Upgrade to {planName}
    </Button>
  );
}
