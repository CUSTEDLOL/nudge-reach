import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { decryptSecret } from "@/lib/crypto";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetaAppForm } from "./meta-app-form";

/** Render only for a workspace owner/admin; never pass secrets to agent roles. */
export async function MetaAppSetup({ orgId, hasNumber }: { orgId: string; hasNumber: boolean }) {
  const connection = await prisma.whatsappConnection.findUnique({ where: { orgId } });
  const requestHeaders = await headers();
  const baseUrl = env.NEXT_PUBLIC_APP_URL || `https://${requestHeaders.get("host") ?? "localhost:3000"}`;
  const callback = connection ? `${baseUrl.replace(/\/$/, "")}/api/webhooks/whatsapp/${connection.webhookKey}` : null;
  return <Card>
    <CardHeader><CardTitle>Your business&apos;s Meta connection</CardTitle></CardHeader>
    <CardContent className="space-y-5">
      <p className="text-sm text-neutral-600">These settings belong only to this workspace. Connect your own Meta app here; no hosting changes are needed.</p>
      <ol className="space-y-2 text-sm">
        <li>1. App credentials: <b>{connection ? "Saved" : "Not saved"}</b></li>
        <li>2. WhatsApp number credentials: <b>{hasNumber ? "Saved" : "Add your number below"}</b></li>
        <li>3. Webhook: <b>{connection?.verifiedAt ? "Verified by Meta" : "Waiting for verification"}</b></li>
        <li>4. Real incoming message: <b>{connection?.lastInboundAt ? `Received ${connection.lastInboundAt.toISOString()}` : "Not received yet"}</b></li>
      </ol>
      <details open={!connection}>
        <summary className="cursor-pointer text-sm font-semibold">{connection ? "Update Meta app credentials" : "1. Save your Meta app"}</summary>
        <div className="mt-4"><MetaAppForm appId={connection?.appId} /></div>
      </details>
      {connection && callback && <div className="space-y-3 rounded-xl border border-neutral-200 p-4">
        <p className="text-sm font-semibold">3. In this Meta app, open WhatsApp → Production setup → Configure Webhooks</p>
        <label className="block text-sm">Callback URL<input aria-label="Callback URL" readOnly value={callback} className="mt-1 w-full rounded border p-2 font-mono text-xs" /></label>
        <label className="block text-sm">Verify token<input aria-label="Verify token" readOnly value={decryptSecret(connection.verifyTokenEncrypted)} className="mt-1 w-full rounded border p-2 font-mono text-xs" /></label>
        <p className="text-sm text-neutral-600">Copy both values, click Verify and save, then subscribe to <b>messages</b> and <b>message_template_status_update</b>. Ensure this app is subscribed to your WhatsApp Business Account.</p>
        <p className="text-sm text-neutral-600">4. Send a fresh WhatsApp message from another phone to your business number, then refresh this page. Meta&apos;s sample test does not count as a real incoming message.</p>
        <p className="text-sm text-neutral-600">A received message confirms delivery to Nudge. An automatic reply also needs live mode and your AI Agent enabled.</p>
      </div>}
    </CardContent>
  </Card>;
}
