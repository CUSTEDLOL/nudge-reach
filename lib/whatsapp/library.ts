import { prisma } from "@/lib/db";
import { campaignContentSchema, type CampaignContent } from "@/lib/campaign/schema";

/**
 * Org-scoped template library (spec §M5): Template rows with campaignId null.
 * Owned by M5; consumed by the inbox template sender (M2) and the campaign
 * wizard (M4).
 */
export interface LibraryTemplate {
  id: string;
  name: string;
  category: string;
  language: string;
  /** §7-shape editable content; null for legacy campaign-built templates. */
  content: CampaignContent | null;
}

/** Approved library templates, ready to send. */
export async function getApprovedTemplates(
  orgId: string
): Promise<LibraryTemplate[]> {
  const rows = await prisma.template.findMany({
    where: { orgId, metaStatus: "APPROVED" },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map((t) => {
    const parsed = campaignContentSchema.safeParse(t.content);
    return {
      id: t.id,
      name: t.name,
      category: t.category,
      language: t.language,
      content: parsed.success ? parsed.data : null,
    };
  });
}
