import { prisma } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { checkMultiNumber } from "@/modules/billing/limits";

/**
 * E4 multi-number: an org may hold several WhatsApp numbers. Exactly one is
 * the default (enforced here); the 2nd+ number gates on the multiNumber plan
 * flag. The old single-number call sites keep working — `getWhatsappAccount`
 * / `getWhatsappCredentials` without an account id resolve the default.
 */

export async function listWhatsappAccounts(orgId: string) {
  return prisma.whatsappAccount.findMany({
    where: { orgId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
}

/** The org's default account (isDefault, else oldest), or null. */
export async function getDefaultWhatsappAccount(orgId: string) {
  return prisma.whatsappAccount.findFirst({
    where: { orgId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
}

/**
 * Save a WhatsApp connection. Upserts by phone number: re-entering an
 * existing number updates it; a new number creates a second account (plan-
 * gated). The org's first account becomes the default.
 */
export async function saveWhatsappAccount(input: {
  orgId: string;
  wabaId: string;
  phoneNumberId: string;
  displayName: string;
  accessToken: string;
}): Promise<
  | { ok: true; account: Awaited<ReturnType<typeof getDefaultWhatsappAccount>> }
  | { ok: false; message: string }
> {
  const accessTokenEncrypted = encryptSecret(input.accessToken);
  const existing = await prisma.whatsappAccount.findUnique({
    where: { phoneNumberId: input.phoneNumberId },
  });
  if (existing && existing.orgId !== input.orgId) {
    return {
      ok: false,
      message: "That phone number is already connected to another workspace.",
    };
  }

  const count = await prisma.whatsappAccount.count({ where: { orgId: input.orgId } });
  if (!existing && count >= 1) {
    const gate = await checkMultiNumber(input.orgId);
    if (!gate.allowed) return { ok: false, message: gate.message };
  }

  // A connected number is what takes the org out of test mode.
  await prisma.org.update({
    where: { id: input.orgId },
    data: { simulated: false },
  });
  const account = await prisma.whatsappAccount.upsert({
    where: { phoneNumberId: input.phoneNumberId },
    create: {
      orgId: input.orgId,
      wabaId: input.wabaId,
      phoneNumberId: input.phoneNumberId,
      displayName: input.displayName,
      accessTokenEncrypted,
      isDefault: count === 0,
    },
    update: {
      wabaId: input.wabaId,
      displayName: input.displayName,
      accessTokenEncrypted,
    },
  });
  return { ok: true, account };
}

/** Make one of the org's accounts the default (org-scoped, atomic enough). */
export async function setDefaultWhatsappAccount(orgId: string, accountId: string) {
  const target = await prisma.whatsappAccount.findFirst({
    where: { id: accountId, orgId },
  });
  if (!target) return false;
  await prisma.$transaction([
    prisma.whatsappAccount.updateMany({ where: { orgId }, data: { isDefault: false } }),
    prisma.whatsappAccount.update({ where: { id: accountId }, data: { isDefault: true } }),
  ]);
  return true;
}

/** Disconnect one number; if it was the default, the oldest survivor takes over. */
export async function disconnectWhatsappAccount(orgId: string, accountId: string) {
  const target = await prisma.whatsappAccount.findFirst({
    where: { id: accountId, orgId },
  });
  if (!target) return false;
  await prisma.whatsappAccount.delete({ where: { id: accountId } });
  if (target.isDefault) {
    const survivor = await prisma.whatsappAccount.findFirst({
      where: { orgId },
      orderBy: { createdAt: "asc" },
    });
    if (survivor) {
      await prisma.whatsappAccount.update({
        where: { id: survivor.id },
        data: { isDefault: true },
      });
    }
  }
  return true;
}

/**
 * Back-compat single-account read: the DEFAULT account. Callers that care
 * about a specific number pass `whatsappAccountId`.
 */
export async function getWhatsappAccount(orgId: string, whatsappAccountId?: string | null) {
  if (whatsappAccountId) {
    const account = await prisma.whatsappAccount.findFirst({
      where: { id: whatsappAccountId, orgId },
    });
    if (account) return account;
    // A stale/deleted account id falls back to the default so sends survive.
  }
  return getDefaultWhatsappAccount(orgId);
}

/** Decrypted credentials for Cloud API calls (live mode only). */
export async function getWhatsappCredentials(
  orgId: string,
  whatsappAccountId?: string | null
) {
  const account = await getWhatsappAccount(orgId, whatsappAccountId);
  if (!account) return null;
  return {
    wabaId: account.wabaId,
    phoneNumberId: account.phoneNumberId,
    accessToken: decryptSecret(account.accessTokenEncrypted),
  };
}
