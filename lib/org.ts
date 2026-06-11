import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * One org per user (PRD §3). Finds the signed-in user's org or creates it
 * on first visit. Safe against the double-request race on first load.
 */
export async function ensureOrg(userId: string, email?: string) {
  const existing = await prisma.org.findUnique({
    where: { ownerUserId: userId },
  });
  if (existing) return existing;

  const name = email ? `${email.split("@")[0]}'s shop` : "My shop";
  try {
    return await prisma.org.create({
      data: { ownerUserId: userId, name },
    });
  } catch (err) {
    // Unique violation: another concurrent request created it first.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return prisma.org.findUniqueOrThrow({ where: { ownerUserId: userId } });
    }
    throw err;
  }
}
