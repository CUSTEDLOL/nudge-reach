import { prisma } from "@/lib/db";
import { sendMessage } from "@/modules/messaging";
import { campaignContentSchema } from "@/modules/campaign/schema";

export interface FollowUpContact {
  id: string;
  orgId: string;
  name: string;
  phoneE164: string;
  optedIn: boolean;
  optedOutAt: Date | null;
}

/**
 * Send an APPROVED library template to a contact through the SAME gated path as
 * automations: template must be approved + org-scoped; MARKETING sends pass the
 * consent gate inside sendMessage; simulation vs live is chosen there too. Threads
 * the outbound into the inbox when a conversation is known. Never throws.
 */
export async function sendApprovedTemplate(
  contact: FollowUpContact,
  templateName: string,
  conversationId?: string | null
): Promise<{ ok: boolean; blockedByConsent?: boolean; error?: string }> {
  const template = await prisma.template.findFirst({
    where: { orgId: contact.orgId, name: templateName, campaignId: null },
  });
  if (!template) return { ok: false, error: "template missing" };
  if (template.metaStatus !== "APPROVED") {
    return { ok: false, error: `template ${template.metaStatus.toLowerCase()}` };
  }

  // E4: follow-ups leave from the conversation's own number when known.
  const convo = conversationId
    ? await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { whatsappAccountId: true },
      })
    : null;

  const firstName = contact.name.split(" ")[0] || contact.name;
  const sent = await sendMessage(
    "whatsapp",
    {
      address: contact.phoneE164,
      optedIn: contact.optedIn,
      optedOutAt: contact.optedOutAt,
    },
    {
      kind: "template",
      category: template.category === "MARKETING" ? "MARKETING" : "UTILITY",
      templateName: template.name,
      language: template.language,
      bodyParams: [firstName],
    },
    { orgId: contact.orgId, whatsappAccountId: convo?.whatsappAccountId }
  );
  if (!sent.ok) {
    return { ok: false, blockedByConsent: sent.blockedByConsent, error: sent.error };
  }

  if (conversationId) {
    const parsed = campaignContentSchema.safeParse(template.content);
    const body = parsed.success
      ? parsed.data.body.replaceAll("{{1}}", firstName)
      : `Template: ${template.name}`;
    const now = new Date();
    await prisma.$transaction([
      prisma.conversationMessage.create({
        data: { conversationId, direction: "outbound", body, metaMessageId: null },
      }),
      prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: now, lastMessagePreview: body.slice(0, 140) },
      }),
      prisma.contact.update({
        where: { id: contact.id },
        data: { lastContactedAt: now },
      }),
    ]);
  }

  return { ok: true };
}
