import { prisma } from "@/lib/db";
import { orgSendMode } from "@/modules/orgs/mode";
import { submitRowToMeta } from "@/modules/whatsapp/library";

/**
 * What has to be true the moment a workspace can send for real. Called after
 * a WhatsApp number is connected and after a founder flips a workspace live.
 * Two leftovers from test mode would otherwise break the first live day:
 *
 *  1. A test calendar. A real customer would be "booked" into a calendar that
 *     does not exist. Remove it; the owner connects real Google instead, and
 *     until then the AI records the request for staff to confirm.
 *  2. Templates Meta has never seen. Test mode approves follow-up templates
 *     instantly with a mock id, and a live workspace with no number yet cannot
 *     submit at all. Either way every follow-up would fail at Meta. Submit
 *     them now, for real.
 *
 * Never throws: connecting a number must not fail because a template did.
 */

export interface GoLiveResult {
  testCalendarRemoved: boolean;
  templatesSubmitted: number;
  templatesRefused: number;
}

/** Meta's ids are numeric; anything else (or nothing) never reached Meta. */
export function neverSeenByMeta(metaTemplateId: string | null): boolean {
  return !metaTemplateId || metaTemplateId.startsWith("sim-");
}

export async function prepareWorkspaceForLive(orgId: string): Promise<GoLiveResult> {
  const result: GoLiveResult = {
    testCalendarRemoved: false,
    templatesSubmitted: 0,
    templatesRefused: 0,
  };
  // A workspace still in test mode keeps its test calendar and mock approvals.
  if ((await orgSendMode(orgId)) !== "live") return result;

  try {
    const removed = await prisma.calendarAccount.deleteMany({
      where: { orgId, simulated: true },
    });
    result.testCalendarRemoved = removed.count > 0;
  } catch (error) {
    console.error("[go-live] removing the test calendar failed", error);
  }

  // Library templates only (follow-ups, reminders, inbox templates). Campaign
  // templates carry product images and are resubmitted from the campaign.
  const hasNumber = (await prisma.whatsappAccount.count({ where: { orgId } })) > 0;
  if (!hasNumber) return result;

  const rows = await prisma.template.findMany({
    where: { orgId, campaignId: null },
    orderBy: { name: "asc" },
    take: 50,
  });
  for (const row of rows) {
    if (!neverSeenByMeta(row.metaTemplateId)) continue;
    try {
      await submitRowToMeta(orgId, row);
      result.templatesSubmitted++;
    } catch (error) {
      result.templatesRefused++;
      await prisma.template
        .update({
          where: { id: row.id },
          data: {
            metaStatus: "REJECTED",
            metaTemplateId: null,
            rejectionReason:
              error instanceof Error ? error.message : "Couldn't submit to Meta.",
          },
        })
        .catch(() => undefined);
    }
  }
  return result;
}
