import type { PrismaClient } from "@prisma/client";
import { seedDemoWorkspace, type SeedCounts } from "@/lib/demo/seed";

/**
 * "Reset demo data" (simulation mode only, OWNER only — enforced by the
 * calling action): wipe the workspace's CRM data, then re-seed the demo
 * workspace fresh. Deliberately KEEPS the account plumbing — memberships,
 * invites, WhatsApp connection, webhooks, API keys, plan/billing state and
 * the append-only audit log.
 */
export async function resetDemoWorkspace(
  prisma: PrismaClient,
  orgId: string
): Promise<SeedCounts> {
  // Children of these cascade (steps, messages, contact/conversation tags,
  // audience members, conversation messages), so org-scoped deletes on the
  // parents are enough. Order avoids FK surprises regardless.
  await prisma.$transaction([
    prisma.automationRun.deleteMany({ where: { orgId } }),
    prisma.automation.deleteMany({ where: { orgId } }),
    prisma.campaign.deleteMany({ where: { orgId } }),
    prisma.product.deleteMany({ where: { orgId } }),
    prisma.template.deleteMany({ where: { orgId } }),
    prisma.note.deleteMany({ where: { orgId } }),
    prisma.conversation.deleteMany({ where: { orgId } }),
    prisma.audience.deleteMany({ where: { orgId } }),
    prisma.contact.deleteMany({ where: { orgId } }),
    prisma.tag.deleteMany({ where: { orgId } }),
  ]);

  return seedDemoWorkspace(prisma, orgId);
}
