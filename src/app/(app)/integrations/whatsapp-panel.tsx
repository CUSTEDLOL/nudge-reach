import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { CopyButton } from "./copy-button";
import { TestConnectionButton } from "./test-connection-button";

/**
 * The WhatsApp tile's panel. Connecting a number is a guided job that lives on
 * Settings → WhatsApp; this keeps the two things people come back for — a
 * connection test and the Meta webhook URL — one click from the directory.
 */
export function WhatsappPanel({
  connected,
  displayName,
  wabaId,
  phoneNumberId,
  simulation,
  webhookUrl,
}: {
  connected: boolean;
  displayName: string | null;
  wabaId: string | null;
  phoneNumberId: string | null;
  simulation: boolean;
  webhookUrl: string;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        {connected ? (
          <Badge tone="success">Connected</Badge>
        ) : simulation ? (
          <Badge tone="info">Test mode</Badge>
        ) : (
          <Badge tone="neutral">Not connected</Badge>
        )}
        <p className="text-sm text-neutral-600">
          {connected
            ? `Sending as “${displayName ?? "your number"}” over Meta's official Cloud API.`
            : simulation
              ? "Every reply is mocked until a real number is connected — nothing reaches a customer."
              : "Connect your WhatsApp Business number to start sending."}
        </p>
      </div>

      {connected && wabaId && phoneNumberId && (
        <dl className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-neutral-500">WhatsApp Business Account</dt>
            <dd className="font-mono text-neutral-900">{wabaId}</dd>
          </div>
          <div className="mt-2 flex justify-between gap-3">
            <dt className="text-neutral-500">Phone number ID</dt>
            <dd className="font-mono text-neutral-900">{phoneNumberId}</dd>
          </div>
        </dl>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <TestConnectionButton />
        <Link
          href="/settings/whatsapp"
          className={buttonVariants({ variant: connected ? "secondary" : "primary" })}
        >
          {connected ? "Manage number" : "Connect a number"}
        </Link>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
          Meta webhook URL
        </p>
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-3">
          <code className="min-w-0 break-all font-mono text-sm text-neutral-900">
            {webhookUrl}
          </code>
          <CopyButton value={webhookUrl} label="Copy webhook URL" />
        </div>
        <p className="mt-2 text-xs leading-relaxed text-neutral-500">
          Only needed if you are wiring Meta by hand: paste it under WhatsApp →
          Configuration → Webhooks, with your verify token.
        </p>
      </div>
    </div>
  );
}
