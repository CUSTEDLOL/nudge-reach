import { prisma } from "@/lib/db";
import { requireOrgContext, requireRole } from "@/modules/orgs/auth";
import { csvRow } from "@/lib/csv";

/**
 * Message-history export (spec §M8): every conversation message and campaign
 * message for the org as one CSV, newest first. Bulk export of customer
 * conversations → ADMIN-gated. Conversation rows carry the message body;
 * campaign rows carry the campaign name and delivery status (template bodies
 * live on the campaign, not per recipient).
 */
export async function GET() {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
  } catch {
    return new Response("Forbidden", { status: 403 });
  }
  const org = ctx.org;

  const [conversationMessages, campaignMessages] = await Promise.all([
    prisma.conversationMessage.findMany({
      where: { conversation: { orgId: org.id } },
      include: {
        conversation: {
          select: { contact: { select: { name: true, phoneE164: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.message.findMany({
      where: { campaign: { orgId: org.id } },
      include: {
        contact: { select: { name: true, phoneE164: true } },
        campaign: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const rows: { at: Date; cells: string[] }[] = [];

  for (const m of conversationMessages) {
    rows.push({
      at: m.createdAt,
      cells: [
        "conversation",
        m.direction,
        m.conversation.contact.name,
        m.conversation.contact.phoneE164,
        m.body,
        "", // campaign
        "", // delivery status
        m.metaMessageId ?? "",
        m.createdAt.toISOString(),
      ],
    });
  }

  for (const m of campaignMessages) {
    rows.push({
      at: m.createdAt,
      cells: [
        "campaign",
        "outbound",
        m.contact.name,
        m.contact.phoneE164,
        "", // body lives on the campaign template
        m.campaign.name,
        m.status,
        m.metaMessageId ?? "",
        m.createdAt.toISOString(),
      ],
    });
  }

  rows.sort((a, b) => b.at.getTime() - a.at.getTime());

  const header = [
    "type",
    "direction",
    "contact",
    "phone",
    "body",
    "campaign",
    "status",
    "providerMessageId",
    "createdAt",
  ].join(",");

  const csv =
    [header, ...rows.map((r) => csvRow(r.cells))].join("\r\n") + "\r\n";
  const date = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="nudge-messages-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
