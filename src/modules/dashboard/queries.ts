/**
 * Dashboard stat queries — server-only, org-scoped, efficient
 * (counts + one groupBy; no row scans). Consumed by
 * app/(app)/dashboard/page.tsx and app/(app)/onboarding/page.tsx.
 */
import type { CampaignStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { orgSendMode } from "@/modules/orgs/mode";
import {
  buildChecklist,
  computeMessageRates,
  type Checklist,
  type MessageRates,
} from "@/modules/dashboard/stats";

export interface RecentConversation {
  id: string;
  contactName: string;
  status: string;
  unreadCount: number;
  lastMessageAt: Date | null;
  lastMessagePreview: string | null;
}

export interface RecentCampaign {
  id: string;
  name: string;
  status: CampaignStatus;
  createdAt: Date;
  scheduledAt: Date | null;
  recipientCount: number;
}

export interface DashboardData {
  contactCount: number;
  optedInContactCount: number;
  wonContactCount: number;
  openConversationCount: number;
  unreadMessageCount: number;
  campaignsSentCount: number;
  scheduledCampaignCount: number;
  automationCount: number;
  enabledAutomationCount: number;
  rates: MessageRates;
  checklist: Checklist;
  simulationMode: boolean;
  recentConversations: RecentConversation[];
  recentCampaigns: RecentCampaign[];
}

export async function getDashboardData(orgId: string): Promise<DashboardData> {
  const simulationMode = (await orgSendMode(orgId)) === "simulation";

  const [
    contactCount,
    optedInContactCount,
    wonContactCount,
    openConversationCount,
    unreadAggregate,
    campaignsSentCount,
    scheduledCampaignCount,
    messageGroups,
    automationCount,
    enabledAutomationCount,
    whatsappAccountCount,
    conversationCount,
    knowledgeFactCount,
    conversations,
    campaigns,
  ] = await Promise.all([
    prisma.contact.count({ where: { orgId } }),
    prisma.contact.count({ where: { orgId, optedIn: true } }),
    prisma.contact.count({ where: { orgId, leadStage: "WON" } }),
    // "handoff" threads live under Open with a "Needs human" badge (spec §3.2).
    prisma.conversation.count({
      where: { orgId, status: { in: ["open", "handoff"] } },
    }),
    prisma.conversation.aggregate({
      where: { orgId },
      _sum: { unreadCount: true },
    }),
    prisma.campaign.count({
      where: { orgId, status: { in: ["SENT", "SENDING"] } },
    }),
    prisma.campaign.count({ where: { orgId, status: "SCHEDULED" } }),
    prisma.message.groupBy({
      by: ["status"],
      where: { campaign: { orgId } },
      _count: { _all: true },
    }),
    prisma.automation.count({ where: { orgId } }),
    prisma.automation.count({ where: { orgId, enabled: true } }),
    prisma.whatsappAccount.count({ where: { orgId } }),
    prisma.conversation.count({ where: { orgId } }),
    prisma.knowledgeEntry.count({ where: { orgId, status: "active" } }),
    prisma.conversation.findMany({
      where: { orgId },
      orderBy: [
        { lastMessageAt: { sort: "desc", nulls: "last" } },
        { updatedAt: "desc" },
      ],
      take: 5,
      select: {
        id: true,
        status: true,
        unreadCount: true,
        lastMessageAt: true,
        lastMessagePreview: true,
        contact: { select: { name: true } },
      },
    }),
    prisma.campaign.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        scheduledAt: true,
        _count: { select: { messages: true } },
      },
    }),
  ]);

  const countsByStatus: Record<string, number> = {};
  for (const group of messageGroups) {
    countsByStatus[group.status] = group._count._all;
  }

  return {
    contactCount,
    optedInContactCount,
    wonContactCount,
    openConversationCount,
    unreadMessageCount: unreadAggregate._sum.unreadCount ?? 0,
    campaignsSentCount,
    scheduledCampaignCount,
    automationCount,
    enabledAutomationCount,
    rates: computeMessageRates(countsByStatus),
    checklist: buildChecklist({
      whatsappConnected: whatsappAccountCount > 0,
      simulationMode,
      contactCount,
      activeCampaignCount: campaignsSentCount,
      enabledAutomationCount,
      knowledgeFactCount,
      conversationCount,
    }),
    simulationMode,
    recentConversations: conversations.map((c) => ({
      id: c.id,
      contactName: c.contact.name,
      status: c.status,
      unreadCount: c.unreadCount,
      lastMessageAt: c.lastMessageAt,
      lastMessagePreview: c.lastMessagePreview,
    })),
    recentCampaigns: campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      createdAt: c.createdAt,
      scheduledAt: c.scheduledAt,
      recipientCount: c._count.messages,
    })),
  };
}

export interface OnboardingSnapshot {
  contactCount: number;
  whatsappConnected: boolean;
  whatsappDisplayName: string | null;
  simulationMode: boolean;
}

/** What the /onboarding wizard needs to render its three steps. */
export async function getOnboardingSnapshot(
  orgId: string
): Promise<OnboardingSnapshot> {
  const [contactCount, account] = await Promise.all([
    prisma.contact.count({ where: { orgId } }),
    prisma.whatsappAccount.findFirst({
      where: { orgId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: { displayName: true },
    }),
  ]);
  return {
    contactCount,
    whatsappConnected: account !== null,
    whatsappDisplayName: account?.displayName ?? null,
    simulationMode: (await orgSendMode(orgId)) === "simulation",
  };
}
