import { Check, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "./copy-button";
import { RazorpayConnectForm } from "./razorpay-connect-form";

export interface PaymentConnectionView {
  keyIdMasked: string;
  live: boolean;
  webhookUrl: string;
  webhookSecret: string;
  lastEventAt: string | null;
}

/**
 * Customer payments. A live workspace connects its OWN Razorpay account, so
 * deposits land with the business; Nudge never holds a merchant's money.
 * A test workspace keeps the practice links.
 */
export function PaymentsPanel({
  testWorkspace,
  currency,
  canManage,
  connection,
}: {
  testWorkspace: boolean;
  currency: string;
  canManage: boolean;
  connection: PaymentConnectionView | null;
}) {
  if (testWorkspace) {
    return (
      <div className="flex flex-col gap-5">
        <Notice tone="info">
          Payment links work end to end in this test workspace: the practice page marks itself paid, so you can watch the whole flow. Nothing real is charged.
        </Notice>
        <WhatItDoes />
      </div>
    );
  }

  if (currency !== "INR") {
    return (
      <div className="flex flex-col gap-5">
        <Notice tone="info">
          Razorpay collects payments in INR only, and this workspace bills in {currency}. Until another provider is added, the AI never sends a payment link: it tells the customer your team will share payment details.
        </Notice>
        <WhatItDoes />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {connection ? (
        <Notice tone={connection.live ? "ok" : "info"}>
          {connection.live
            ? "Connected. Customers pay straight into your Razorpay account; Nudge never touches the money."
            : "Connected with TEST keys: links work, but no real money moves. Replace them with rzp_live_ keys when Razorpay activates your account."}
        </Notice>
      ) : (
        <Notice tone="info">
          Connect your own Razorpay account and the AI can send deposit links in chat. The money goes straight to you; Nudge never touches it. Until then the AI tells customers your team will share payment details.
        </Notice>
      )}

      {connection && (
        <ol className="flex flex-col gap-2 text-sm">
          <li className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-neutral-900">1. API keys</span>
            <Badge tone="success">Verified with Razorpay</Badge>
            <span className="font-mono text-xs text-neutral-500">{connection.keyIdMasked}</span>
          </li>
          <li className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-neutral-900">2. Webhook</span>
            {connection.lastEventAt ? (
              <Badge tone="success">Receiving · last event {connection.lastEventAt.slice(0, 16).replace("T", " ")} UTC</Badge>
            ) : (
              <Badge tone="warning">Not received yet: add it in Razorpay</Badge>
            )}
          </li>
        </ol>
      )}

      {connection && canManage && (
        <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          <p className="text-sm font-semibold text-neutral-900">
            In Razorpay → Account &amp; Settings → Webhooks → Add new webhook
          </p>
          <CopyRow label="Webhook URL" value={connection.webhookUrl} />
          <CopyRow label="Secret" value={connection.webhookSecret} />
          <p className="text-xs leading-relaxed text-neutral-600">
            Tick the event <b>payment_link.paid</b>, then save. Razorpay then tells Nudge the moment a customer pays, and the booking, the chat and your CRM are updated on their own.
          </p>
        </div>
      )}

      {canManage ? (
        <details open={!connection} className="group">
          <summary className="cursor-pointer text-sm font-semibold text-neutral-900">
            {connection ? "Replace or disconnect the keys" : "Connect your Razorpay account"}
          </summary>
          <div className="mt-4">
            <RazorpayConnectForm connected={Boolean(connection)} />
          </div>
        </details>
      ) : (
        <p className="text-sm text-neutral-500">Ask a workspace owner or admin to connect Razorpay.</p>
      )}

      <WhatItDoes />
    </div>
  );
}

function Notice({ tone, children }: { tone: "ok" | "info"; children: React.ReactNode }) {
  const ok = tone === "ok";
  const Icon = ok ? Check : Info;
  return (
    <div className={ok ? "flex items-start gap-3 rounded-xl bg-brand-50 px-4 py-3" : "flex items-start gap-3 rounded-xl bg-sky-50 px-4 py-3"}>
      <Icon className={ok ? "mt-0.5 h-4 w-4 shrink-0 text-brand-700" : "mt-0.5 h-4 w-4 shrink-0 text-sky-700"} aria-hidden />
      <p className={ok ? "text-sm leading-relaxed text-brand-900" : "text-sm leading-relaxed text-sky-900"}>{children}</p>
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</p>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
        <code className="min-w-0 break-all font-mono text-sm text-neutral-900">{value}</code>
        <CopyButton value={value} label={`Copy ${label.toLowerCase()}`} />
      </div>
    </div>
  );
}

function WhatItDoes() {
  return (
    <>
      <div>
        <h3 className="text-sm font-semibold text-neutral-900">What the AI does with it</h3>
        <ul className="mt-3 flex flex-col gap-2.5">
          {[
            "Sends a deposit link in the chat when it books an appointment.",
            "Chases the customer if the link goes unpaid.",
            "Marks the booking paid and tells your team, without anyone checking.",
          ].map((line) => (
            <li key={line} className="flex gap-2.5 text-sm text-neutral-700">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
              {line}
            </li>
          ))}
        </ul>
      </div>
      <p className="text-sm leading-relaxed text-neutral-500">
        Nudge does not take a cut of your payments. Razorpay&apos;s own transaction fee is the only charge.
      </p>
    </>
  );
}
