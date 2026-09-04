import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizePhoneE164 } from "@/lib/phone";
import { sendMessage } from "@/modules/messaging";
import { isWithinServiceWindow } from "@/modules/agent/window";
import { firstName, toPreview } from "@/modules/inbox/format";
import { campaignContentSchema } from "@/modules/campaign/schema";
import { apiError, resolveApiKeyOrg } from "@/modules/integrations/api-auth";

/**
 * Send a WhatsApp message via the API. Two shapes:
 *  - free-form: { contact_id | phone, text } — ONLY inside the 24h service
 *    window (invariant 6); outside it, 422 tells the caller to use a template.
 *  - template:  { contact_id | phone, template_id, body_params? } — template
 *    must be Meta-APPROVED; the consent gate inside sendMessage still blocks
 *    MARKETING templates to non-opted-in contacts (invariant 2).
 * Both persist to the conversation exactly like the inbox composer.
 */
export async function POST(request: Request) {
  const auth = await resolveApiKeyOrg(request);
  if (!auth.ok) return auth.response;
  const org = auth.org;

  let body: {
    contact_id?: string;
    phone?: string;
    text?: string;
    template_id?: string;
    body_params?: string[];
  };
  try {
    body = await request.json();
  } catch {
    return apiError(400, "Body must be JSON.");
  }

  // Resolve the contact by id or phone — always org-scoped.
  const phone = body.phone ? normalizePhoneE164(body.phone, org.dialCode) : null;
  const contact = body.contact_id
    ? await prisma.contact.findFirst({ where: { id: body.contact_id, orgId: org.id } })
    : phone
      ? await prisma.contact.findUnique({
          where: { orgId_phoneE164: { orgId: org.id, phoneE164: phone } },
        })
      : null;
  if (!contact) return apiError(404, "Contact not found — pass contact_id or phone.");

  const recipient = {
    address: contact.phoneE164,
    optedIn: contact.optedIn,
    optedOutAt: contact.optedOutAt,
  };

  const isTemplate = Boolean(body.template_id);
  const text = body.text?.trim();
  if (!isTemplate && !text) {
    return apiError(422, "Pass text (free-form) or template_id.");
  }
  if (text && text.length > 4096) {
    return apiError(422, "Free-form text is limited to 4096 characters.");
  }

  const conversation = await prisma.conversation.findUnique({
    where: { orgId_contactId: { orgId: org.id, contactId: contact.id } },
  });

  let sentBody: string;
  if (!isTemplate) {
    // Free-form: the 24h window is enforced in code (invariant 6).
    if (!conversation || !isWithinServiceWindow(conversation.lastInboundAt)) {
      return apiError(
        422,
        "The 24-hour service window is closed for this contact — send an approved template instead (template_id)."
      );
    }
    const result = await sendMessage("whatsapp", recipient, { kind: "text", text: text! }, { orgId: org.id });
    if (!result.ok) {
      return apiError(502, result.error ?? "The message didn't send.");
    }
    sentBody = text!;
    await persist(conversation.id, contact.id, sentBody, result.providerMessageId);
    return NextResponse.json({ data: { provider_message_id: result.providerMessageId ?? null, conversation_id: conversation.id } });
  }

  // Template path.
  const template = await prisma.template.findFirst({
    where: { id: body.template_id, orgId: org.id, campaignId: null, metaStatus: "APPROVED" },
  });
  if (!template) {
    return apiError(422, "That template isn't approved (or doesn't exist).");
  }
  const params = body.body_params?.length
    ? body.body_params.map(String)
    : [firstName(contact.name)];

  const result = await sendMessage(
    "whatsapp",
    recipient,
    {
      kind: "template",
      category: template.category === "UTILITY" ? "UTILITY" : "MARKETING",
      templateName: template.name,
      language: template.language,
      bodyParams: params,
    },
    { orgId: org.id }
  );
  if (result.blockedByConsent) {
    return apiError(403, "This contact hasn't opted in to marketing (or opted out), so the template can't be sent.");
  }
  if (!result.ok) {
    return apiError(502, result.error ?? "The template didn't send.");
  }

  // Store the rendered body so the thread shows what the customer saw.
  const parsed = campaignContentSchema.safeParse(template.content);
  sentBody = parsed.success
    ? parsed.data.body.replaceAll("{{1}}", params[0] ?? "")
    : `Sent template “${template.name}”`;

  // A template can open a brand-new thread — upsert without touching lastInboundAt.
  const convo =
    conversation ??
    (await prisma.conversation.upsert({
      where: { orgId_contactId: { orgId: org.id, contactId: contact.id } },
      create: { orgId: org.id, contactId: contact.id },
      update: {},
    }));
  await persist(convo.id, contact.id, sentBody, result.providerMessageId);
  return NextResponse.json({ data: { provider_message_id: result.providerMessageId ?? null, conversation_id: convo.id } });
}

async function persist(
  conversationId: string,
  contactId: string,
  bodyText: string,
  metaMessageId: string | undefined
) {
  const now = new Date();
  await prisma.$transaction([
    prisma.conversationMessage.create({
      data: { conversationId, direction: "outbound", body: bodyText, metaMessageId },
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: now, lastMessagePreview: toPreview(bodyText) },
    }),
    prisma.contact.update({
      where: { id: contactId },
      data: { lastContactedAt: now },
    }),
  ]);
}
