import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { orgSendMode } from "@/modules/orgs/mode";
import { buildTemplatePayload } from "@/modules/whatsapp/template";
import type { CampaignContent } from "@/modules/campaign/schema";

/**
 * Concierge onboarding (5.3): the done-for-you moat. An operator sets a client
 * up in one pass — knowledge base → agent persona, a per-vertical template pack,
 * and a go-live gate. Everything composes existing pieces (AgentProfile, the
 * library template pipeline, the follow-up pack).
 */

export interface KnowledgeBaseInput {
  hours?: string;
  location?: string;
  services?: string;
  prices?: string;
  policies?: string;
  faqs?: string;
}

/**
 * Flatten the KB into the single grounding string the agent reads
 * (AgentProfile.businessInfo). Kept as structured text so the runtime prompt
 * path needs zero changes and the agent still treats it as its only source of
 * truth (never invents).
 */
export function buildBusinessInfo(input: KnowledgeBaseInput): string {
  const section = (label: string, value?: string) =>
    value && value.trim() ? `${label}:\n${value.trim()}` : null;
  return [
    section("HOURS", input.hours),
    section("LOCATION", input.location),
    section("SERVICES", input.services),
    section("PRICES", input.prices),
    section("BOOKING & POLICIES", input.policies),
    section("FAQs", input.faqs),
  ]
    .filter(Boolean)
    .join("\n\n");
}

interface VerticalTemplate {
  name: string;
  category: "MARKETING" | "UTILITY";
  content: CampaignContent;
}

const OPT_OUT = "Reply STOP to unsubscribe";

function marketing(
  name: string,
  header: string,
  body: string
): VerticalTemplate {
  return {
    name,
    category: "MARKETING",
    content: {
      productName: name,
      campaignAngle: "Concierge vertical pack.",
      header,
      body,
      footer: OPT_OUT,
      buttons: [{ type: "QUICK_REPLY", text: "Book now" }],
      sampleName: "Priya",
      imageTreatment: "",
      notes: "Installed by concierge onboarding.",
    },
  };
}

/** One vertical, done deeply (clinics/salons first per the strategy). */
export const VERTICAL_PACKS: Record<string, VerticalTemplate[]> = {
  clinic: [
    marketing(
      "clinic_booking_invite",
      "Book your visit",
      "Hi {{1}}, need to see us? Just reply here and we'll book you the next available appointment — quick and easy."
    ),
    marketing(
      "clinic_checkup_reminder",
      "Time for a check-up?",
      "Hi {{1}}, it's been a while since your last visit. Reply here to book a check-up — your health matters to us."
    ),
  ],
  salon: [
    marketing(
      "salon_booking_invite",
      "Ready for your next look?",
      "Hi {{1}}, ready for your next appointment? Reply here and we'll book your slot with your favourite stylist."
    ),
    marketing(
      "salon_treat_yourself",
      "Treat yourself",
      "Hi {{1}}, treat yourself this week — reply here to book and ask about our current offers."
    ),
  ],
};

export function verticalPackFor(vertical: string): VerticalTemplate[] {
  return VERTICAL_PACKS[vertical] ?? [];
}

/** Create the vertical's marketing templates (approved in simulation so the
 *  demo works; pending in live). Idempotent by (orgId, name). */
export async function installVerticalPack(
  orgId: string,
  vertical: string
): Promise<number> {
  const pack = verticalPackFor(vertical);
  const approve = (await orgSendMode(orgId)) !== "live";
  for (const t of pack) {
    const componentsJson = buildTemplatePayload(t.content, {
      name: t.name,
    }) as Prisma.InputJsonValue;
    const data = {
      language: "en",
      category: t.category,
      content: t.content as unknown as Prisma.InputJsonValue,
      componentsJson,
      metaStatus: approve ? ("APPROVED" as const) : ("PENDING" as const),
      metaTemplateId: approve ? `sim-tpl-${t.name}` : null,
    };
    const existing = await prisma.template.findFirst({
      where: { orgId, name: t.name, campaignId: null },
    });
    if (existing) {
      await prisma.template.update({ where: { id: existing.id }, data });
    } else {
      await prisma.template.create({
        data: { orgId, campaignId: null, name: t.name, ...data },
      });
    }
  }
  return pack.length;
}

export interface ConciergeStatus {
  agentConfigured: boolean;
  agentEnabled: boolean;
  calendarConnected: boolean;
  approvedTemplates: number;
  followUpEnabled: boolean;
  ready: boolean;
}

/** The client go-live gate — computed from REAL state (mirrors the WhatsApp
 *  go-live checklist), not stored flags. */
export async function getConciergeStatus(orgId: string): Promise<ConciergeStatus> {
  const [profile, calendar, approvedTemplates, followUp, knowledgeCount] =
    await Promise.all([
      prisma.agentProfile.findUnique({ where: { orgId } }),
      prisma.calendarAccount.findUnique({ where: { orgId } }),
      prisma.template.count({
        where: { orgId, campaignId: null, metaStatus: "APPROVED" },
      }),
      prisma.followUpConfig.findUnique({ where: { orgId } }),
      prisma.knowledgeEntry.count({ where: { orgId, status: "active" } }),
    ]);
  // Structured knowledge counts as a configured KB, same as the legacy blob.
  const agentConfigured =
    Boolean(profile && profile.businessInfo.trim().length > 0) ||
    knowledgeCount > 0;
  const agentEnabled = Boolean(profile?.enabled);
  const calendarConnected = Boolean(calendar);
  const followUpEnabled = Boolean(followUp?.enabled);
  return {
    agentConfigured,
    agentEnabled,
    calendarConnected,
    approvedTemplates,
    followUpEnabled,
    ready:
      agentConfigured &&
      agentEnabled &&
      calendarConnected &&
      approvedTemplates > 0 &&
      followUpEnabled,
  };
}
