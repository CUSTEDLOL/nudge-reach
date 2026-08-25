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
  /** Campaigns that are SENT or SENDING. */
  activeCampaignCount: number;
  enabledAutomationCount: number;
  /** Active KnowledgeEntry rows — the AI's structured brain. */
  knowledgeFactCount: number;
  /** Any conversation at all — the "try your AI" tester creates one too. */
  conversationCount: number;
}

export interface ChecklistItem {
  key:
    | "knowledge"
    | "tryit"
    | "whatsapp"
    | "contacts"
    | "campaign"
    | "automation";
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

/** Onboarding checklist, computed from real org data — AI employee first,
 * broadcasting last (it is a feature inside the Front Desk, not the headline). */
export function buildChecklist(input: ChecklistInput): Checklist {
  const items: ChecklistItem[] = [
    {
      key: "knowledge",
      title: "Teach your AI the business",
      description:
        input.knowledgeFactCount > 0
          ? "It answers from your own facts — nothing else."
          : "Run the questionnaire so it answers like your best staff.",
      href: "/agent/questionnaire",
      done: input.knowledgeFactCount > 0,
    },
    {
      key: "tryit",
      title: "Try your AI",
      description:
        input.conversationCount > 0
          ? "You've watched it answer."
          : "Message it as a customer and watch it reply.",
      href: "/inbox/try",
      done: input.conversationCount > 0,
    },
    {
      key: "whatsapp",
      title: "Connect WhatsApp",
      description: input.whatsappConnected
        ? "Your business number is linked."
        : input.simulationMode
          ? "Test mode until your number is live — we set it up with you."
          : "Link your WhatsApp Business number.",
      href: "/settings/whatsapp",
      done: input.whatsappConnected || input.simulationMode,
    },
    {
      key: "contacts",
      title: "Bring in opted-in customers",
      description:
        input.contactCount > CHECKLIST_CONTACT_TARGET
          ? "Your opted-in customer list is in."
          : `Add ${CHECKLIST_CONTACT_TARGET + 1}+ customers who said yes to WhatsApp.`,
      href: "/contacts",
      done: input.contactCount > CHECKLIST_CONTACT_TARGET,
    },
    {
      key: "campaign",
      title: "Send your first campaign",
      description:
        input.activeCampaignCount > 0
          ? "Your first broadcast is out."
          : "Offers and reminders, only to your opted-in list.",
      href: "/campaigns/new",
      done: input.activeCampaignCount > 0,
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
