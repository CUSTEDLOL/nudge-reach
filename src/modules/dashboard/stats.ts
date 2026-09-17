/**
 * Pure dashboard math — no Prisma, no env — so it is unit-testable
 * (tests/dashboard.test.ts). lib/dashboard/queries.ts feeds these from
 * real org-scoped data.
 */

import type { AttentionKind } from "@/modules/dashboard/workspace-profile";

/** Spec §M8: Org.settings.avgOrderValueInr default. */
export const DEFAULT_AVG_ORDER_VALUE_INR = 1499;

/** A contact list is "imported" once it crosses this size (checklist). */
export const CHECKLIST_CONTACT_TARGET = 5;

/** Message statuses that mean "the message actually went out". */
const SENT_STATUSES = ["SENT", "DELIVERED", "READ", "CLICKED"] as const;
const DELIVERED_STATUSES = ["DELIVERED", "READ", "CLICKED"] as const;
const READ_STATUSES = ["READ", "CLICKED"] as const;

type DashboardRole = "OWNER" | "ADMIN" | "AGENT";

/** Discovery changes organization-wide settings, so only members who can
 * complete it should ever be redirected into the wizard. */
export function shouldRedirectToOnboarding(input: {
  role: DashboardRole;
  onboardedAt: Date | null;
  contactCount: number;
}): boolean {
  return (
    input.role !== "AGENT" &&
    input.onboardedAt === null &&
    nonNegativeInteger(input.contactCount) === 0
  );
}

export interface AttentionQueueInput {
  role: DashboardRole;
  attentionOrder: AttentionKind[];
  handoffCount: number;
  ownerQuestionCount: number;
  unreadMessageCount: number;
  pendingBookingCount: number;
  pendingPaymentCount: number;
  followupsEnabled: boolean;
  setupRemaining: number;
}

export interface AttentionItem {
  kind: AttentionKind;
  title: string;
  description: string;
  href: string;
  count: number;
  urgent: boolean;
}

export interface AttentionQueue {
  items: AttentionItem[];
  totalCount: number;
  hiddenCount: number;
  hiddenItems?: AttentionItem[];
  allClear: boolean;
}

const ATTENTION_FALLBACK_ORDER: AttentionKind[] = [
  "handoff",
  "owner-question",
  "unread",
  "booking",
  "payment",
  "followup",
  "setup",
];

const AGENT_ATTENTION = new Set<AttentionKind>(["handoff", "unread"]);

function nonNegativeInteger(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function attentionCandidates(input: AttentionQueueInput): AttentionItem[] {
  const handoffs = nonNegativeInteger(input.handoffCount);
  const ownerQuestions = nonNegativeInteger(input.ownerQuestionCount);
  const unread = nonNegativeInteger(input.unreadMessageCount);
  const bookings = nonNegativeInteger(input.pendingBookingCount);
  const payments = nonNegativeInteger(input.pendingPaymentCount);
  const setupRemaining = nonNegativeInteger(input.setupRemaining);

  return [
    handoffs > 0
      ? {
          kind: "handoff",
          title: "Customer handoffs",
          description: `${handoffs} conversation${handoffs === 1 ? " is" : "s are"} waiting for a person.`,
          href: "/inbox?filter=handoff",
          count: handoffs,
          urgent: true,
        }
      : null,
    ownerQuestions > 0
      ? {
          kind: "owner-question",
          title: "Questions only you can answer",
          description: `Teach your Front Desk ${ownerQuestions} answer${ownerQuestions === 1 ? "" : "s"}, once.`,
          href: "/agent",
          count: ownerQuestions,
          urgent: false,
        }
      : null,
    unread > 0
      ? {
          kind: "unread",
          title: "Unread customer messages",
          description: `${unread} new message${unread === 1 ? " needs" : "s need"} a look.`,
          href: "/inbox?filter=unread",
          count: unread,
          urgent: false,
        }
      : null,
    bookings > 0
      ? {
          kind: "booking",
          title: "Booking requests to confirm",
          description: `${bookings} request${bookings === 1 ? " is" : "s are"} still pending.`,
          href: "/bookings?view=pending",
          count: bookings,
          urgent: false,
        }
      : null,
    payments > 0
      ? {
          kind: "payment",
          title: "Payments awaiting customers",
          description: `${payments} payment link${payments === 1 ? " is" : "s are"} still open.`,
          href: "/inbox",
          count: payments,
          urgent: false,
        }
      : null,
    !input.followupsEnabled
      ? {
          kind: "followup",
          title: "Follow-ups are paused",
          description: "Review Revenue Recovery before quiet leads slip away.",
          href: "/automations",
          count: 1,
          urgent: false,
        }
      : null,
    setupRemaining > 0
      ? {
          kind: "setup",
          title: "Finish workspace setup",
          description: `${setupRemaining} setup step${setupRemaining === 1 ? " remains" : "s remain"}.`,
          href: "/onboarding?customize=1",
          count: setupRemaining,
          urgent: false,
        }
      : null,
  ].filter((item): item is AttentionItem => item !== null);
}

/** Deterministic, role-aware priority list for the owner's Today page. */
export function buildAttentionQueue(
  input: AttentionQueueInput
): AttentionQueue {
  const allowed = attentionCandidates(input).filter(
    (item) => input.role !== "AGENT" || AGENT_ATTENTION.has(item.kind)
  );
  const byKind = new Map(allowed.map((item) => [item.kind, item]));
  const requestedOrder = Array.from(
    new Set([...input.attentionOrder, ...ATTENTION_FALLBACK_ORDER])
  );
  const ordered = requestedOrder.flatMap((kind) => {
    const item = byKind.get(kind);
    return item ? [item] : [];
  });
  const handoffIndex = ordered.findIndex((item) => item.kind === "handoff");
  if (handoffIndex > 0) {
    const [handoff] = ordered.splice(handoffIndex, 1);
    ordered.unshift(handoff);
  }

  const totalCount = ordered.length;
  const items = ordered.slice(0, 4);
  return {
    items,
    totalCount,
    hiddenCount: Math.max(0, totalCount - items.length),
    ...(totalCount > items.length ? { hiddenItems: ordered.slice(4) } : {}),
    allClear: totalCount === 0,
  };
}

export interface OperationsSummaryInput {
  bookingsToday: number;
  pendingBookings: number;
  openConversations: number;
  followUpsThisMonth: number;
  pendingPayments: number;
  pendingPaymentAmountMinor: number;
}

export type OperationsSummaryItem =
  | {
      key: "bookings";
      label: string;
      value: number;
      detailCount: number;
      detailLabel: string;
      href: string;
    }
  | {
      key: "conversations" | "followups";
      label: string;
      value: number;
      href: string;
    }
  | {
      key: "payments";
      label: string;
      value: number;
      amountMinor: number;
      href: string;
    };

/** The four operational facts shown above analytics on Today. */
export function buildOperationsSummary(
  input: OperationsSummaryInput
): OperationsSummaryItem[] {
  return [
    {
      key: "bookings",
      label: "Appointments today",
      value: nonNegativeInteger(input.bookingsToday),
      detailCount: nonNegativeInteger(input.pendingBookings),
      detailLabel: "requests to confirm",
      href: "/bookings",
    },
    {
      key: "conversations",
      label: "Open conversations",
      value: nonNegativeInteger(input.openConversations),
      href: "/inbox",
    },
    {
      key: "followups",
      label: "Follow-ups sent",
      value: nonNegativeInteger(input.followUpsThisMonth),
      href: "/automations",
    },
    {
      key: "payments",
      label: "Payments awaiting",
      value: nonNegativeInteger(input.pendingPayments),
      amountMinor: nonNegativeInteger(input.pendingPaymentAmountMinor),
      href: "/inbox",
    },
  ];
}

function timezoneOffsetMs(instant: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  const representedAsUtc = Date.UTC(
    value("year"),
    value("month") - 1,
    value("day"),
    value("hour"),
    value("minute"),
    value("second")
  );
  return representedAsUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

function zonedMidnightUtc(
  year: number,
  month: number,
  day: number,
  timezone: string
): Date {
  const target = Date.UTC(year, month - 1, day);
  let candidate = new Date(target);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    candidate = new Date(target - timezoneOffsetMs(candidate, timezone));
  }
  return candidate;
}

/** UTC range containing the workspace's local calendar day. */
export function dayBoundsInTimezone(
  timezone: string,
  now: Date = new Date()
): { start: Date; end: Date } {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const value = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value ?? 0);
    const localDateUtc = Date.UTC(
      value("year"),
      value("month") - 1,
      value("day")
    );
    const nextLocalDate = new Date(localDateUtc + 86_400_000);
    return {
      start: zonedMidnightUtc(
        value("year"),
        value("month"),
        value("day"),
        timezone
      ),
      end: zonedMidnightUtc(
        nextLocalDate.getUTCFullYear(),
        nextLocalDate.getUTCMonth() + 1,
        nextLocalDate.getUTCDate(),
        timezone
      ),
    };
  } catch {
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    return { start, end: new Date(start.getTime() + 86_400_000) };
  }
}

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
  /** Test workspaces get different wording — never a tick (see buildChecklist). */
  simulationMode: boolean;
  contactCount: number;
  /** Campaigns that are SENT or SENDING. */
  activeCampaignCount: number;
  enabledAutomationCount: number;
  /** Active KnowledgeEntry rows — the AI's structured brain. */
  knowledgeFactCount: number;
  /** Any conversation at all — the "try your AI" tester creates one too. */
  conversationCount: number;
  /** AgentProfile.enabled — the AI answers only when this is on. */
  agentEnabled: boolean;
  /** A calendar (real or test) is connected. */
  calendarConnected: boolean;
  /** FollowUpConfig.enabled. */
  followupsEnabled: boolean;
  /** Calls the AI has taken, including browser test calls. */
  voiceCallCount: number;
  /** Plan entitlements decide which steps exist at all. */
  hasFrontDesk: boolean;
  hasVoice: boolean;
}

export interface ChecklistItem {
  key:
    | "knowledge"
    | "agent_on"
    | "tryit"
    | "calendar"
    | "followups"
    | "voice"
    | "contacts"
    | "whatsapp";
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

/**
 * Setup checklist, computed from real org data and the plan. The AI employee
 * first, going live last. Two rules the founder set on 2026-09-17:
 *  - test mode never ticks a step ("Connect WhatsApp" used to show done for
 *    every test workspace);
 *  - steps only exist for what the plan includes, and campaigns are not a
 *    step at all (AGENTS.md: never the headline).
 */
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
      key: "agent_on",
      title: "Switch your AI on",
      description: input.agentEnabled
        ? "It replies to new messages instantly."
        : "It stays silent until this is on — including in Try your AI.",
      href: "/agent/setup",
      done: input.agentEnabled,
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
  ];

  if (input.hasFrontDesk) {
    items.push({
      key: "calendar",
      title: "Connect your calendar",
      description: input.calendarConnected
        ? "The AI books straight into it."
        : "So the AI can book real appointments around your availability.",
      href: "/integrations",
      done: input.calendarConnected,
    });
  }

  items.push({
    key: "followups",
    title: "Turn on follow-ups",
    description: input.followupsEnabled
      ? "Quiet leads get chased and bookings get reminders."
      : "Chase leads that go quiet and remind people about bookings.",
    href: "/automations",
    done: input.followupsEnabled,
  });

  if (input.hasVoice) {
    items.push({
      key: "voice",
      title: "Hear it answer a call",
      description:
        input.voiceCallCount > 0
          ? "It picks up the phone too."
          : "Call your AI from the browser — no phone number needed yet.",
      href: "/agent/voice",
      done: input.voiceCallCount > 0,
    });
  }

  items.push(
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
      key: "whatsapp",
      title: "Go live on WhatsApp",
      description: input.whatsappConnected
        ? "Your business number is linked."
        : input.simulationMode
          ? "We connect your number with you — nothing here reaches a real customer yet."
          : "We connect your WhatsApp Business number with you.",
      href: "/settings/whatsapp",
      done: input.whatsappConnected,
    }
  );

  const completed = items.filter((item) => item.done).length;
  return {
    items,
    completed,
    total: items.length,
    allDone: completed === items.length,
  };
}
