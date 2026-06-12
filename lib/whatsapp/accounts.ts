import { prisma } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

/** Save (or replace) the org's WhatsApp connection; token encrypted at rest. */
export async function saveWhatsappAccount(input: {
  orgId: string;
  wabaId: string;
  phoneNumberId: string;
  displayName: string;
  accessToken: string;
}) {
  const accessTokenEncrypted = encryptSecret(input.accessToken);
  return prisma.whatsappAccount.upsert({
    where: { orgId: input.orgId },
    create: {
      orgId: input.orgId,
      wabaId: input.wabaId,
      phoneNumberId: input.phoneNumberId,
      displayName: input.displayName,
      accessTokenEncrypted,
    },
    update: {
      wabaId: input.wabaId,
      phoneNumberId: input.phoneNumberId,
      displayName: input.displayName,
      accessTokenEncrypted,
    },
  });
}

export async function getWhatsappAccount(orgId: string) {
  return prisma.whatsappAccount.findUnique({ where: { orgId } });
}

/** Decrypted credentials for Cloud API calls (live mode only). */
export async function getWhatsappCredentials(orgId: string) {
  const account = await getWhatsappAccount(orgId);
  if (!account) return null;
  return {
    wabaId: account.wabaId,
    phoneNumberId: account.phoneNumberId,
    accessToken: decryptSecret(account.accessTokenEncrypted),
  };
}
