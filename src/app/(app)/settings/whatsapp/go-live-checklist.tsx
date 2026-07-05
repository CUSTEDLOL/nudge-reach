import Link from "next/link";
import { CheckCircle2, Circle, ExternalLink } from "lucide-react";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { canSendMarketing } from "@/modules/consent";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

/**
 * Go-live checklist (spec phase 5): computed server-side from real state so
 * the owner always knows exactly what stands between simulation and the first
 * real WhatsApp message. Rendered on Settings → WhatsApp.
 */

interface ChecklistItem {
  done: boolean;
  title: string;
  hint: string;
  href?: string;
  linkLabel?: string;
}

export async function GoLiveChecklist({ orgId }: { orgId: string }) {
  const [account, approvedTemplates, contacts] = await Promise.all([
    prisma.whatsappAccount.findUnique({ where: { orgId } }),
    prisma.template.count({
      where: { orgId, campaignId: null, metaStatus: "APPROVED" },
    }),
    prisma.contact.findMany({
      where: { orgId },
      select: { optedIn: true, optedOutAt: true },
    }),
  ]);
  const optedIn = contacts.filter(canSendMarketing).length;

  const live = env.SEND_MODE === "live";
  const webhookEnvReady = Boolean(
    env.WHATSAPP_WEBHOOK_VERIFY_TOKEN && env.META_APP_SECRET
  );
  const encryptionReady = Boolean(env.TOKEN_ENCRYPTION_KEY);

  const items: ChecklistItem[] = [
    {
      done: Boolean(account),
      title: "Connect your WhatsApp number",
      hint: account
        ? `Connected as “${account.displayName}” — the token is stored encrypted.`
        : "Paste WABA ID, phone number ID, display name and access token from Meta's dashboard into the form above.",
    },
    {
      done: webhookEnvReady,
      title: "Set the webhook secrets",
      hint: webhookEnvReady
        ? "WHATSAPP_WEBHOOK_VERIFY_TOKEN and META_APP_SECRET are set — Meta's events can be verified."
        : "Set WHATSAPP_WEBHOOK_VERIFY_TOKEN (any random string) and META_APP_SECRET (App Settings → Basic) in your deployment env, then point Meta's webhook at your /api/webhooks/whatsapp URL.",
      href: "/integrations",
      linkLabel: "Webhook URL & test",
    },
    {
      done: encryptionReady,
      title: "Set the token encryption key",
      hint: encryptionReady
        ? "TOKEN_ENCRYPTION_KEY is set — access tokens are encrypted at rest."
        : "Set TOKEN_ENCRYPTION_KEY (32+ random chars, e.g. `openssl rand -hex 32`) in your deployment env.",
    },
    {
      done: approvedTemplates > 0,
      title: "Get a template approved",
      hint:
        approvedTemplates > 0
          ? `${approvedTemplates} approved template${approvedTemplates === 1 ? "" : "s"} ready — campaigns and out-of-window replies can send.`
          : "Marketing messages need a Meta-approved template. Create one in the library and submit it for review.",
      href: "/templates",
      linkLabel: "Template library",
    },
    {
      done: optedIn > 0,
      title: "Have opted-in contacts",
      hint:
        optedIn > 0
          ? `${optedIn.toLocaleString("en-IN")} contact${optedIn === 1 ? "" : "s"} opted in to marketing.`
          : "Import or add contacts with explicit WhatsApp opt-in — campaigns only ever send to opted-in people.",
      href: "/contacts",
      linkLabel: "Contacts",
    },
    {
      done: live,
      title: "Flip SEND_MODE to live",
      hint: live
        ? "Live mode is on — sends go over the real Cloud API."
        : "The final switch: set SEND_MODE=live in your deployment env and redeploy. The app refuses to boot in live mode with missing credentials, so a misconfiguration can't half-send.",
    },
  ];

  const doneCount = items.filter((i) => i.done).length;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-neutral-900">
          Go-live checklist
        </h2>
        <Badge tone={doneCount === items.length ? "success" : "brand"}>
          {doneCount} of {items.length}
        </Badge>
      </div>
      <p className="mt-1 text-sm text-neutral-500">
        Everything between simulation and your first real WhatsApp message.
        Full runbook: <span className="font-mono text-xs">docs/GO_LIVE_WHATSAPP.md</span>
      </p>
      <ol className="mt-4 flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.title} className="flex items-start gap-3">
            {item.done ? (
              <CheckCircle2
                className="mt-0.5 h-4.5 w-4.5 shrink-0 text-brand-600"
                aria-hidden
              />
            ) : (
              <Circle
                className="mt-0.5 h-4.5 w-4.5 shrink-0 text-neutral-300"
                aria-hidden
              />
            )}
            <div className="min-w-0">
              <p
                className={
                  item.done
                    ? "text-sm font-medium text-neutral-500 line-through decoration-neutral-300"
                    : "text-sm font-medium text-neutral-900"
                }
              >
                {item.title}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-neutral-500">
                {item.hint}
                {item.href && !item.done && (
                  <>
                    {" "}
                    <Link
                      href={item.href}
                      className="inline-flex items-center gap-0.5 font-medium text-brand-700 underline-offset-2 hover:underline"
                    >
                      {item.linkLabel}
                      <ExternalLink className="h-3 w-3" aria-hidden />
                    </Link>
                  </>
                )}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
