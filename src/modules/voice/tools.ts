import { prisma } from "@/lib/db";
import { runTool, type ToolContext } from "@/modules/agent/tools";
import { crmContactCreated } from "@/modules/crm/events";
import type { VoiceCallSource } from "@/modules/voice/tool-token";

/**
 * The agent's hands on a phone call. ElevenLabs calls these as webhook tools;
 * each maps onto the same org-scoped tool handlers the WhatsApp agent uses.
 * Hand-off is not here: on calls it is ElevenLabs' transfer_to_number.
 */

export const VOICE_TOOLS = [
  "capture_booking_request",
  "capture_lead",
  "ask_owner",
] as const;
export type VoiceToolName = (typeof VOICE_TOOLS)[number];

export function isVoiceTool(name: string): name is VoiceToolName {
  return (VOICE_TOOLS as readonly string[]).includes(name);
}

/** Resolve the caller into the same ToolContext the chat agent gets. */
export async function voiceToolContext(
  orgId: string,
  contactPhone: string,
  source: VoiceCallSource
): Promise<ToolContext> {
  const existing = await prisma.contact.findUnique({
    where: { orgId_phoneE164: { orgId, phoneE164: contactPhone } },
    select: { id: true },
  });
  const contact = await prisma.contact.upsert({
    where: { orgId_phoneE164: { orgId, phoneE164: contactPhone } },
    create: { orgId, phoneE164: contactPhone, name: contactPhone, optInSource: "voice" },
    update: {},
  });
  if (!existing && source === "phone") {
    await crmContactCreated(orgId, contact, "Phone (Nudge)");
  }
  const conversation = await prisma.conversation.upsert({
    where: { orgId_contactId: { orgId, contactId: contact.id } },
    create: { orgId, contactId: contact.id, channel: "voice" },
    update: {},
  });
  return {
    orgId,
    contactId: contact.id,
    conversationId: conversation.id,
    contactName: contact.name,
    contactPhone,
    channel: "voice",
    externalSync: source === "phone",
  };
}

export async function runVoiceTool(
  name: VoiceToolName,
  orgId: string,
  contactPhone: string,
  source: VoiceCallSource,
  input: Record<string, unknown>
) {
  const ctx = await voiceToolContext(orgId, contactPhone, source);
  return runTool(ctx, { name, input });
}
