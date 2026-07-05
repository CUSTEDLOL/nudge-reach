import { prisma } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import type { CalendarCredentials } from "@/modules/calendar/types";

/**
 * Per-org calendar connection (mirrors whatsapp/accounts.ts). The OAuth refresh
 * token is encrypted at rest; a SIMULATED connection stores the literal "sim"
 * sentinel and never touches encryptSecret, so the flow works with zero keys.
 */
export async function saveCalendarAccount(input: {
  orgId: string;
  accountEmail: string;
  refreshToken: string;
  calendarId?: string;
  simulated?: boolean;
}) {
  const simulated = input.simulated ?? false;
  const refreshTokenEncrypted = simulated ? "sim" : encryptSecret(input.refreshToken);
  const calendarId = input.calendarId ?? "primary";
  return prisma.calendarAccount.upsert({
    where: { orgId: input.orgId },
    create: {
      orgId: input.orgId,
      provider: "google",
      accountEmail: input.accountEmail,
      calendarId,
      refreshTokenEncrypted,
      simulated,
    },
    update: {
      accountEmail: input.accountEmail,
      calendarId,
      refreshTokenEncrypted,
      simulated,
      status: "connected",
    },
  });
}

export async function getCalendarAccount(orgId: string) {
  return prisma.calendarAccount.findUnique({ where: { orgId } });
}

export async function disconnectCalendar(orgId: string) {
  return prisma.calendarAccount.deleteMany({ where: { orgId } });
}

/** Decrypted credentials for real Google API calls (live, non-simulated only). */
export async function getCalendarCredentials(
  orgId: string
): Promise<CalendarCredentials | null> {
  const account = await getCalendarAccount(orgId);
  if (!account || account.simulated) return null;
  return {
    refreshToken: decryptSecret(account.refreshTokenEncrypted),
    calendarId: account.calendarId,
    accountEmail: account.accountEmail,
  };
}
