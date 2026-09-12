import { prisma } from "@/lib/db";
import {
  disconnectWhatsappAccount,
  saveWhatsappAccount,
  setDefaultWhatsappAccount,
} from "@/modules/whatsapp/accounts";
import {
  validateWhatsappConnection,
  type WhatsappConnectionInput,
} from "@/modules/whatsapp/connection-validator";
import { disconnectCalendar } from "@/modules/calendar/accounts";
import { deleteLlmAccount, getLlmAccount } from "@/modules/ai/llm-account";
import { disconnect as disconnectCrm } from "@/modules/crm/connections";
import type { CrmProviderKey } from "@/modules/crm/types";
import { revokeApiKey } from "@/modules/integrations/api-keys";
import { voiceUsage } from "@/modules/voice/usage";
import { founderAudit, withReason, type FounderResult } from "@/modules/admin/audit";
import { confirmationMatches, requireReason } from "@/modules/admin/confirmation";

/**
 * Everything connected to one org, and the founder actions on it. Reads show
 * status/metadata only — never a token, key or secret (they're encrypted at
 * rest and stay that way). Mutations reuse the exact module functions the
 * client's own settings pages call, so behaviour can't drift.
 */
export async function integrationsOverview(orgId: string) {
  const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [whatsapp, calendar, llm, voiceNumbers, voice, crm, deadJobs, apiKeys, webhooks, customActions] =
    await Promise.all([
      prisma.whatsappAccount.findMany({
        where: { orgId },
        select: { id: true, displayName: true, phoneNumberId: true, wabaId: true, status: true, qualityRating: true, isDefault: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.calendarAccount.findUnique({
        where: { orgId },
        select: { provider: true, accountEmail: true, calendarId: true, status: true, simulated: true, updatedAt: true },
      }),
      getLlmAccount(orgId),
      prisma.voiceNumber.findMany({
        where: { orgId },
        select: { id: true, phoneE164: true, provider: true, label: true, language: true, enabled: true, transferTo: true },
        orderBy: { createdAt: "asc" },
      }),
      voiceUsage(orgId),
      prisma.crmConnection.findMany({
        where: { orgId },
        select: { id: true, provider: true, accountLabel: true, status: true, lastError: true, lastSyncAt: true, simulated: true },
      }),
      prisma.crmSyncJob.groupBy({ by: ["provider"], where: { orgId, status: "dead" }, _count: true }),
      prisma.apiKey.findMany({
        where: { orgId },
        select: { id: true, name: true, prefix: true, lastUsedAt: true, revokedAt: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.webhookEndpoint.findMany({
        where: { orgId },
        select: {
          id: true,
          url: true,
          enabled: true,
          lastStatus: true,
          lastDeliveryAt: true,
          _count: { select: { deliveries: { where: { ok: false, createdAt: { gte: since7 } } } } },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.customAction.findMany({
        where: { orgId },
        select: { id: true, name: true, method: true, url: true, enabled: true },
        orderBy: { name: "asc" },
      }),
    ]);
  const dead: Record<string, number> = {};
  for (const row of deadJobs) dead[row.provider] = row._count;
  return { whatsapp, calendar, llm, voiceNumbers, voice, crm, deadJobsByProvider: dead, apiKeys, webhooks, customActions };
}
export type IntegrationsOverview = Awaited<ReturnType<typeof integrationsOverview>>;

export async function founderConnectWhatsapp(
  orgId: string,
  input: WhatsappConnectionInput,
  founderEmail: string,
  reason?: string
): Promise<FounderResult> {
  const requiredReason = requireReason(reason);
  if (!requiredReason.ok) return requiredReason;

  const org = await prisma.org.findUnique({
    where: { id: orgId },
    select: { id: true },
  });
  if (!org) return { ok: false, error: "Organization not found." };

  const validation = await validateWhatsappConnection(input);
  if (!validation.ok) return { ok: false, error: validation.message };

  const { displayName, wabaId, phoneNumberId } = validation.value;
  return prisma.$transaction(async (tx) => {
    const saved = await saveWhatsappAccount(
      { orgId, ...validation.value },
      { activateOrg: false, db: tx }
    );
    if (!saved.ok) return { ok: false, error: saved.message };

    await founderAudit(
      orgId,
      founderEmail,
      "admin.integration_changed",
      `WhatsApp ${displayName}`,
      withReason(
        `wabaId ${wabaId}; phoneNumberId ${phoneNumberId} connected or refreshed; sending mode unchanged`,
        requiredReason.value
      ),
      tx
    );
    return {
      ok: true,
      message: `${displayName} connected. Sending mode was not changed.`,
    };
  });
}


export async function founderDisconnectNumber(orgId: string, accountId: string, founderEmail: string, reason?: string, confirmation?: string): Promise<FounderResult> {
  const requiredReason = requireReason(reason);
  if (!requiredReason.ok) return requiredReason;
  const acct = await prisma.whatsappAccount.findFirst({ where: { id: accountId, orgId }, select: { displayName: true, phoneNumberId: true } });
  if (!acct) return { ok: false, error: "Number not found in this org." };
  if (!confirmationMatches(acct.displayName, confirmation ?? "")) {
    return { ok: false, error: `Type "${acct.displayName}" exactly to confirm.` };
  }
  await disconnectWhatsappAccount(orgId, accountId);
  await founderAudit(orgId, founderEmail, "admin.integration_disconnected", `WhatsApp ${acct.displayName}`, withReason(`phoneNumberId ${acct.phoneNumberId} removed`, requiredReason.value));
  return { ok: true, message: `${acct.displayName} disconnected.` };
}

export async function founderSetDefaultNumber(orgId: string, accountId: string, founderEmail: string): Promise<FounderResult> {
  const acct = await prisma.whatsappAccount.findFirst({ where: { id: accountId, orgId }, select: { displayName: true } });
  if (!acct) return { ok: false, error: "Number not found in this org." };
  await setDefaultWhatsappAccount(orgId, accountId);
  await founderAudit(orgId, founderEmail, "admin.integration_changed", `WhatsApp ${acct.displayName}`, "set as default number");
  return { ok: true, message: `${acct.displayName} is now the default number.` };
}

export async function founderDisconnectCalendar(orgId: string, founderEmail: string, reason?: string, confirmation?: string): Promise<FounderResult> {
  const requiredReason = requireReason(reason);
  if (!requiredReason.ok) return requiredReason;
  const cal = await prisma.calendarAccount.findUnique({ where: { orgId }, select: { accountEmail: true } });
  if (!cal) return { ok: false, error: "No calendar connected." };
  if (!confirmationMatches(cal.accountEmail, confirmation ?? "")) {
    return { ok: false, error: `Type "${cal.accountEmail}" exactly to confirm.` };
  }
  await disconnectCalendar(orgId);
  await founderAudit(orgId, founderEmail, "admin.integration_disconnected", `Calendar ${cal.accountEmail}`, withReason("calendar disconnected", requiredReason.value));
  return { ok: true, message: "Calendar disconnected. Bookings fall back to simulation." };
}

export async function founderDisconnectLlm(orgId: string, founderEmail: string, reason?: string, confirmation?: string): Promise<FounderResult> {
  const requiredReason = requireReason(reason);
  if (!requiredReason.ok) return requiredReason;
  const llm = await getLlmAccount(orgId);
  if (!llm) return { ok: false, error: "No customer LLM key connected." };
  const expected = `${llm.provider}/${llm.model}`;
  if (!confirmationMatches(expected, confirmation ?? "")) {
    return { ok: false, error: `Type "${expected}" exactly to confirm.` };
  }
  await deleteLlmAccount(orgId);
  await founderAudit(orgId, founderEmail, "admin.integration_disconnected", `BYOK ${expected}`, withReason("key deleted; back on platform model", requiredReason.value));
  return { ok: true, message: `Removed the ${llm.provider} key. Back on Nudge's built-in model.` };
}

export async function founderSetVoiceNumberEnabled(orgId: string, voiceNumberId: string, enabled: boolean, founderEmail: string, reason?: string): Promise<FounderResult> {
  const num = await prisma.voiceNumber.findFirst({ where: { id: voiceNumberId, orgId }, select: { phoneE164: true, enabled: true } });
  if (!num) return { ok: false, error: "Voice number not found in this org." };
  if (num.enabled === enabled) return { ok: false, error: `Already ${enabled ? "enabled" : "disabled"}.` };
  await prisma.voiceNumber.update({ where: { id: voiceNumberId }, data: { enabled } });
  await founderAudit(orgId, founderEmail, "admin.integration_changed", `Voice ${num.phoneE164}`, withReason(enabled ? "enabled" : "disabled", reason));
  return { ok: true, message: `${num.phoneE164} ${enabled ? "enabled" : "disabled"}.` };
}

export async function founderDisconnectCrm(orgId: string, provider: string, founderEmail: string, reason?: string, confirmation?: string): Promise<FounderResult> {
  const requiredReason = requireReason(reason);
  if (!requiredReason.ok) return requiredReason;
  const conn = await prisma.crmConnection.findFirst({ where: { orgId, provider }, select: { id: true, accountLabel: true } });
  if (!conn) return { ok: false, error: "No such CRM connection." };
  if (!confirmationMatches(provider, confirmation ?? "")) {
    return { ok: false, error: `Type "${provider}" exactly to confirm.` };
  }
  await disconnectCrm(orgId, provider as CrmProviderKey);
  await founderAudit(orgId, founderEmail, "admin.integration_disconnected", `CRM ${provider}`, withReason(`${conn.accountLabel || provider} disconnected`, requiredReason.value));
  return { ok: true, message: `${provider} disconnected.` };
}

export async function founderRevokeApiKey(orgId: string, keyId: string, founderEmail: string, reason?: string, confirmation?: string): Promise<FounderResult> {
  const requiredReason = requireReason(reason);
  if (!requiredReason.ok) return requiredReason;
  const key = await prisma.apiKey.findFirst({ where: { id: keyId, orgId }, select: { name: true, prefix: true, revokedAt: true } });
  if (!key) return { ok: false, error: "API key not found in this org." };
  if (key.revokedAt) return { ok: false, error: "Already revoked." };
  if (!confirmationMatches(key.prefix, confirmation ?? "")) {
    return { ok: false, error: `Type "${key.prefix}" exactly to confirm.` };
  }
  await revokeApiKey(orgId, keyId);
  await founderAudit(orgId, founderEmail, "admin.integration_changed", `API key ${key.name}`, withReason(`${key.prefix}… revoked`, requiredReason.value));
  return { ok: true, message: `API key "${key.name}" revoked.` };
}

export async function founderSetWebhookEnabled(orgId: string, endpointId: string, enabled: boolean, founderEmail: string, reason?: string): Promise<FounderResult> {
  const ep = await prisma.webhookEndpoint.findFirst({ where: { id: endpointId, orgId }, select: { url: true, enabled: true } });
  if (!ep) return { ok: false, error: "Webhook endpoint not found in this org." };
  if (ep.enabled === enabled) return { ok: false, error: `Already ${enabled ? "enabled" : "disabled"}.` };
  await prisma.webhookEndpoint.update({ where: { id: endpointId }, data: { enabled } });
  await founderAudit(orgId, founderEmail, "admin.integration_changed", `Webhook ${ep.url}`, withReason(enabled ? "enabled" : "disabled", reason));
  return { ok: true, message: `Webhook ${enabled ? "enabled" : "disabled"}.` };
}

export async function founderSetCustomActionEnabled(orgId: string, actionId: string, enabled: boolean, founderEmail: string, reason?: string): Promise<FounderResult> {
  const a = await prisma.customAction.findFirst({ where: { id: actionId, orgId }, select: { name: true, enabled: true } });
  if (!a) return { ok: false, error: "Custom action not found in this org." };
  if (a.enabled === enabled) return { ok: false, error: `Already ${enabled ? "enabled" : "disabled"}.` };
  await prisma.customAction.update({ where: { id: actionId }, data: { enabled } });
  await founderAudit(orgId, founderEmail, "admin.integration_changed", `Custom action ${a.name}`, withReason(enabled ? "enabled" : "disabled", reason));
  return { ok: true, message: `${a.name} ${enabled ? "enabled" : "disabled"}.` };
}
