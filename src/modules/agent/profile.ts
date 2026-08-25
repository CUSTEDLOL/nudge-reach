import { prisma } from "@/lib/db";

/**
 * The AI employee is on shift from day one: a workspace that never opened the
 * Setup tab still gets a profile — enabled, named after the business, scoped
 * to its vertical — so the first "try your AI" message gets an answer. The
 * owner can switch it off on AI Agent → Setup; that choice is respected.
 */
export async function ensureAgentProfile(orgId: string) {
  const existing = await prisma.agentProfile.findUnique({ where: { orgId } });
  if (existing) return existing;
  const org = await prisma.org.findUnique({
    where: { id: orgId },
    select: { name: true, vertical: true },
  });
  if (!org) return null;
  return prisma.agentProfile.upsert({
    where: { orgId },
    update: {},
    create: {
      orgId,
      enabled: true,
      vertical: org.vertical ?? "other",
      businessName: org.name,
    },
  });
}
