import Link from "next/link";
import { CheckCircle2, Circle, ExternalLink } from "lucide-react";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { canSendMarketing } from "@/modules/consent";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

/**
 * What stands between this workspace and real customers — computed from real
 * state, phrased for the business owner (platform env vars are not their job).
 */

interface ChecklistItem {
  done: boolean;
  title: string;
  hint: string;
  href?: string;
  linkLabel?: string;
}

export async function GoLiveChecklist({ orgId }: { orgId: string }) {
  const [account, approvedTemplates, knowledgeFacts, contacts] =
    await Promise.all([
      prisma.whatsappAccount.findUnique({ where: { orgId } }),
      prisma.template.count({
        where: { orgId, campaignId: null, metaStatus: "APPROVED" },
      }),
      prisma.knowledgeEntry.count({ where: { orgId, status: "active" } }),
      prisma.contact.findMany({
        where: { orgId },
        select: { optedIn: true, optedOutAt: true },
      }),
    ]);
  const optedIn = contacts.filter(canSendMarketing).length;
  const simulation = env.SEND_MODE === "simulation";

  const items: ChecklistItem[] = [
    {
      done: knowledgeFacts > 0,
      title: "Teach the AI your business",
      hint:
        knowledgeFacts > 0
          ? `${knowledgeFacts} fact${knowledgeFacts === 1 ? "" : "s"} in its memory — it answers from these, nothing else.`
          : "Run the questionnaire or import your website so it answers like your best staff.",
      href: "/agent/questionnaire",
      linkLabel: "Teach it",
    },
    {
      done: Boolean(account),
      title: "Connect your WhatsApp number",
      hint: account
        ? `Connected as “${account.displayName}”.`
        : "We do this with you on the setup call — nothing to paste.",
    },
    {
      done: optedIn > 0,
      title: "Bring in opted-in customers",
      hint:
        optedIn > 0
          ? `${optedIn.toLocaleString("en-IN")} customer${optedIn === 1 ? "" : "s"} said yes to WhatsApp.`
          : "Import the customers who agreed to hear from you — follow-ups and offers only ever go to them.",
      href: "/contacts",
      linkLabel: "Contacts",
    },
    {
      done: approvedTemplates > 0,
      title: "Get your first template approved",
      hint:
        approvedTemplates > 0
          ? `${approvedTemplates} approved template${approvedTemplates === 1 ? "" : "s"} — reminders and follow-ups can go out.`
          : "Reminders, follow-ups and offers go out as Meta-approved templates. We submit the first set for you.",
      href: "/templates",
      linkLabel: "Templates",
    },
  ];

  const doneCount = items.filter((i) => i.done).length;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-neutral-900">Going live</h2>
        <Badge tone={doneCount === items.length ? "success" : "brand"}>
          {doneCount} of {items.length}
        </Badge>
      </div>
      <p className="mt-1 text-sm text-neutral-500">
        {simulation
          ? "Everything runs in test mode for now. Here's what stands between you and real customers."
          : "What stands between you and real customers."}
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
