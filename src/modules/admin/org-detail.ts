import { prisma } from "@/lib/db";

/**
 * Everything the founder panel shows about ONE workspace. Cross-org module
 * rules apply (see queries.ts header): reads only, and never a customer
 * message body — counts and metadata.
 */

export async function orgDetail(orgId: string) {
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const org = await prisma.org.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      name: true,
      plan: true,
      simulated: true,
      vertical: true,
      currency: true,
      dialCode: true,
      timezone: true,
      subscriptionStatus: true,
      createdAt: true,
      onboardedAt: true,
      memberships: {
        select: { email: true, displayName: true, role: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
      whatsappAccounts: {
        select: {
          displayName: true,
          phoneNumberId: true,
          status: true,
          isDefault: true,
          qualityRating: true,
        },
        orderBy: { createdAt: "asc" },
      },
      agentProfile: { select: { enabled: true, vertical: true, tone: true } },
      followUpConfig: { select: { enabled: true } },
      _count: {
        select: {
          contacts: true,
          conversations: true,
          knowledgeEntries: true,
          bookingRequests: true,
          paymentRequests: true,
        },
      },
    },
  });
  if (!org) return null;

  const [templates, aiCost, pendingQuestions, events, audit] = await Promise.all([
    prisma.template.findMany({
      where: { orgId, campaignId: null },
      select: { name: true, metaStatus: true, rejectionReason: true },
      orderBy: { submittedAt: "desc" },
      take: 25,
    }),
    prisma.aiUsage.aggregate({
      where: { orgId, createdAt: { gte: since30 } },
      _sum: { costMicroUsd: true },
      _count: true,
    }),
    prisma.ownerQuestion.count({ where: { orgId, status: "pending" } }),
    prisma.contactEvent.findMany({
      where: { orgId },
      select: { type: true, contactId: true, props: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.auditLog.findMany({
      where: { orgId },
      select: { actorName: true, action: true, target: true, detail: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return {
    org,
    templates,
    aiCostMicroUsd30d: aiCost._sum.costMicroUsd ?? 0,
    aiCalls30d: aiCost._count,
    pendingQuestions,
    events,
    audit,
  };
}

export type OrgDetail = NonNullable<Awaited<ReturnType<typeof orgDetail>>>;
