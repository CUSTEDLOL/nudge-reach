/**
 * Pure dashboard math — no Prisma, no env — so it is unit-testable
 * (tests/dashboard.test.ts). lib/dashboard/queries.ts feeds these from
 * real org-scoped data.
 */

/** Spec §M8: Org.settings.avgOrderValueInr default. */
export const DEFAULT_AVG_ORDER_VALUE_INR = 1499;

/** A contact list is "imported" once it crosses this size (checklist). */
export const CHECKLIST_CONTACT_TARGET = 5;

/** Message statuses that mean "the message actually went out". */
const SENT_STATUSES = ["SENT", "DELIVERED", "READ", "CLICKED"] as const;
const DELIVERED_STATUSES = ["DELIVERED", "READ", "CLICKED"] as const;
const READ_STATUSES = ["READ", "CLICKED"] as const;

export interface MessageRates {
  /** Messages that left the queue (SENT or further along). */
  sentTotal: number;
  deliveredCount: number;
  readCount: number;
  /** 0..1, or null when nothing has been sent yet (render as "—"). */
  deliveredRate: number | null;
  readRate: number | null;
}

/**
 * Delivery/read rates from a Message-status histogram. Statuses are
 * cumulative (READ implies DELIVERED implies SENT), so each bucket counts
 * its own status plus everything further along.
 */
export function computeMessageRates(
  countsByStatus: Record<string, number>
): MessageRates {
  const sum = (keys: readonly string[]) =>
    keys.reduce((acc, key) => acc + (countsByStatus[key] ?? 0), 0);

  const sentTotal = sum(SENT_STATUSES);
  const deliveredCount = sum(DELIVERED_STATUSES);
  const readCount = sum(READ_STATUSES);

  return {
    sentTotal,
    deliveredCount,
    readCount,
    deliveredRate: sentTotal > 0 ? deliveredCount / sentTotal : null,
    readRate: sentTotal > 0 ? readCount / sentTotal : null,
  };
}

/** `Org.settings.avgOrderValueInr` with the spec default (₹1,499). */
export function parseAvgOrderValueInr(settings: unknown): number {
  if (settings && typeof settings === "object" && !Array.isArray(settings)) {
    const raw = (settings as Record<string, unknown>).avgOrderValueInr;
    const value = typeof raw === "string" ? Number(raw) : raw;
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      return value;
    }
  }
  return DEFAULT_AVG_ORDER_VALUE_INR;
}

/**
 * "Revenue influenced" placeholder metric (spec §M1): WON-stage contacts ×
 * the org's average order value. Always labelled an estimate in the UI.
 */
export function estimateRevenueInfluencedInr(
  wonContacts: number,
  settings: unknown
): number {
  return wonContacts * parseAvgOrderValueInr(settings);
}

export interface ChecklistInput {
  /** A real WhatsappAccount row exists for the org. */
  whatsappConnected: boolean;
  /** SEND_MODE=simulation counts as connected (AGENTS.md rule 5). */
  simulationMode: boolean;
  contactCount: number;
  /** Templates belonging to the org (library or campaign-generated). */
  templateCount: number;
  /** Campaigns that are SENT or SENDING. */
  activeCampaignCount: number;
  enabledAutomationCount: number;
}

export interface ChecklistItem {
  key: "whatsapp" | "contacts" | "template" | "campaign" | "automation";
  title: string;
  description: string;
  href: string;
  done: boolean;
}

export interface Checklist {
  items: ChecklistItem[];
  completed: number;
  total: number;
  allDone: boolean;
}

/** Onboarding checklist, computed from real org data (spec §M1). */
export function buildChecklist(input: ChecklistInput): Checklist {
  const items: ChecklistItem[] = [
    {
      key: "whatsapp",
      title: "Connect WhatsApp",
      description: input.whatsappConnected
        ? "Your business number is linked."
        : input.simulationMode
          ? "Simulation mode is on — sends are safely mocked."
          : "Link your WhatsApp Business number.",
      href: "/settings/whatsapp",
      done: input.whatsappConnected || input.simulationMode,
    },
    {
      key: "contacts",
      title: "Import contacts",
      description:
        input.contactCount > CHECKLIST_CONTACT_TARGET
          ? "Your opted-in customer list is in."
          : `Add ${CHECKLIST_CONTACT_TARGET + 1}+ opted-in customers to message.`,
      href: "/contacts",
      done: input.contactCount > CHECKLIST_CONTACT_TARGET,
    },
    {
      key: "template",
      title: "Create a template",
      description:
        input.templateCount > 0
          ? "You have a reusable message template."
          : "Draft a reusable, Meta-compliant message.",
      href: "/templates",
      done: input.templateCount > 0,
    },
    {
      key: "campaign",
      title: "Send a campaign",
      description:
        input.activeCampaignCount > 0
          ? "Your first broadcast is out."
          : "Broadcast your first offer to an audience.",
      href: "/campaigns/new",
      done: input.activeCampaignCount > 0,
    },
    {
      key: "automation",
      title: "Enable an automation",
      description:
        input.enabledAutomationCount > 0
          ? "Replies are being handled automatically."
          : "Auto-reply to keywords and new contacts.",
      href: "/automations",
      done: input.enabledAutomationCount > 0,
    },
  ];

  const completed = items.filter((item) => item.done).length;
  return {
    items,
    completed,
    total: items.length,
    allDone: completed === items.length,
  };
}
