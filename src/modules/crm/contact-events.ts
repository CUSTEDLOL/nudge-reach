import { prisma } from "@/lib/db";
import { enqueueCrmEvent } from "@/modules/crm/sync";
import type { CrmStage } from "@/modules/crm/types";

/**
 * Bridge from the ContactEvent history to CRM sync.
 *
 * Lead stages change in half a dozen places — the inbox, the contacts table,
 * the public API, the agent — and every one of them records a ContactEvent.
 * Hooking the sync here means all of them reach the client's CRM, instead of
 * only the agent's own path.
 */

const STAGE_MAP: Record<string, CrmStage | null> = {
  NEW: "new",
  CONTACTED: "new",
  QUALIFIED: "qualified",
  WON: "paid",
  // A lost lead keeps whatever the CRM already has — we don't overwrite the
  // client's own pipeline with our guess.
  LOST: null,
};

export function crmStageFor(leadStage: string): CrmStage | null {
  return STAGE_MAP[leadStage] ?? null;
}

/**
 * Never throws and never blocks the flow that emitted the event — the same
 * contract as recordContactEvent itself.
 */
export async function syncContactEventToCrm(
  orgId: string,
  type: string,
  opts: { contactId?: string | null; props?: Record<string, unknown> }
): Promise<void> {
  try {
    if (type !== "lead_stage_changed" && type !== "opted_out") return;
    const contactId = opts.contactId;
    if (!contactId) return;

    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { id: true, phoneE164: true, name: true },
    });
    if (!contact) return;

    if (type === "lead_stage_changed") {
      const to = String(opts.props?.to ?? "");
      const stage = crmStageFor(to);
      if (!stage) return;
      // Key by contact + stage so every distinct transition syncs once, while
      // a repeated write of the same stage stays a no-op.
      await enqueueCrmEvent(orgId, "lead.stage_changed", `${contact.id}:${to}`, {
        kind: "stage",
        phoneE164: contact.phoneE164,
        stage,
      });
      return;
    }

    const source = String(opts.props?.source ?? "nudge");
    await enqueueCrmEvent(orgId, "contact.opted_out", contact.id, {
      kind: "activity",
      phoneE164: contact.phoneE164,
      activity: {
        kind: "note",
        title: "Opted out of messages",
        body: `${contact.name} (${contact.phoneE164}) opted out via Nudge (${source}). Do not message them again.`,
      },
    });
  } catch (err) {
    console.error("[crm] contact-event sync failed", err);
  }
}
