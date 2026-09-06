import { describe, expect, it } from "vitest";
import {
  buildAttentionQueue,
  buildChecklist,
  buildOperationsSummary,
  computeMessageRates,
  dayBoundsInTimezone,
  estimateRevenueInfluencedInr,
  parseAvgOrderValueInr,
  DEFAULT_AVG_ORDER_VALUE_INR,
  type AttentionQueueInput,
  type ChecklistInput,
} from "@/modules/dashboard/stats";
import {
  formatCount,
  formatPercent,
  formatRelativeTime,
  greetingForHour,
} from "@/modules/dashboard/format";

describe("computeMessageRates", () => {
  it("returns null rates when nothing has been sent", () => {
    const rates = computeMessageRates({});
    expect(rates.sentTotal).toBe(0);
    expect(rates.deliveredRate).toBeNull();
    expect(rates.readRate).toBeNull();
  });

  it("QUEUED and FAILED messages don't count as sent", () => {
    const rates = computeMessageRates({ QUEUED: 10, FAILED: 3 });
    expect(rates.sentTotal).toBe(0);
    expect(rates.deliveredRate).toBeNull();
  });

  it("treats statuses as cumulative (READ implies DELIVERED implies SENT)", () => {
    // 10 sent total: 2 stuck at SENT, 3 DELIVERED, 4 READ, 1 CLICKED.
    const rates = computeMessageRates({
      QUEUED: 5,
      SENT: 2,
      DELIVERED: 3,
      READ: 4,
      CLICKED: 1,
      FAILED: 2,
    });
    expect(rates.sentTotal).toBe(10);
    expect(rates.deliveredCount).toBe(8);
    expect(rates.readCount).toBe(5);
    expect(rates.deliveredRate).toBeCloseTo(0.8);
    expect(rates.readRate).toBeCloseTo(0.5);
  });
});

describe("parseAvgOrderValueInr", () => {
  it("defaults to ₹1499 (spec §M8)", () => {
    expect(DEFAULT_AVG_ORDER_VALUE_INR).toBe(1499);
    expect(parseAvgOrderValueInr({})).toBe(1499);
    expect(parseAvgOrderValueInr(null)).toBe(1499);
    expect(parseAvgOrderValueInr(undefined)).toBe(1499);
    expect(parseAvgOrderValueInr("garbage")).toBe(1499);
    expect(parseAvgOrderValueInr([])).toBe(1499);
  });

  it("reads a numeric avgOrderValueInr from Org.settings", () => {
    expect(parseAvgOrderValueInr({ avgOrderValueInr: 2500 })).toBe(2500);
  });

  it("accepts numeric strings (JSON round-trips)", () => {
    expect(parseAvgOrderValueInr({ avgOrderValueInr: "999" })).toBe(999);
  });

  it("rejects zero, negatives, NaN and non-numeric values", () => {
    expect(parseAvgOrderValueInr({ avgOrderValueInr: 0 })).toBe(1499);
    expect(parseAvgOrderValueInr({ avgOrderValueInr: -50 })).toBe(1499);
    expect(parseAvgOrderValueInr({ avgOrderValueInr: "abc" })).toBe(1499);
    expect(parseAvgOrderValueInr({ avgOrderValueInr: null })).toBe(1499);
  });
});

describe("estimateRevenueInfluencedInr", () => {
  it("is WON contacts × avg order value", () => {
    expect(estimateRevenueInfluencedInr(4, {})).toBe(4 * 1499);
    expect(estimateRevenueInfluencedInr(3, { avgOrderValueInr: 2000 })).toBe(
      6000
    );
    expect(estimateRevenueInfluencedInr(0, {})).toBe(0);
  });
});

describe("buildChecklist", () => {
  const empty: ChecklistInput = {
    whatsappConnected: false,
    simulationMode: false,
    contactCount: 0,
    activeCampaignCount: 0,
    enabledAutomationCount: 0,
    knowledgeFactCount: 0,
    conversationCount: 0,
  };

  it("everything pending on a fresh live-mode org", () => {
    const checklist = buildChecklist(empty);
    expect(checklist.total).toBe(5);
    expect(checklist.completed).toBe(0);
    expect(checklist.allDone).toBe(false);
    expect(checklist.items.every((i) => !i.done)).toBe(true);
  });

  it("simulation mode counts as WhatsApp connected (AGENTS.md rule 5)", () => {
    const checklist = buildChecklist({ ...empty, simulationMode: true });
    expect(checklist.items.find((i) => i.key === "whatsapp")?.done).toBe(true);
  });

  it("leads with the AI, not broadcasting", () => {
    const keys = buildChecklist(empty).items.map((i) => i.key);
    expect(keys.slice(0, 2)).toEqual(["knowledge", "tryit"]);
    expect(keys[keys.length - 1]).toBe("campaign");
  });

  it("the tester's conversation completes the try-it step", () => {
    const checklist = buildChecklist({ ...empty, conversationCount: 1 });
    expect(checklist.items.find((i) => i.key === "tryit")?.done).toBe(true);
  });

  it("a real WhatsappAccount counts as connected in live mode", () => {
    const checklist = buildChecklist({ ...empty, whatsappConnected: true });
    expect(checklist.items.find((i) => i.key === "whatsapp")?.done).toBe(true);
  });

  it("contacts step needs MORE than 5 contacts", () => {
    const at5 = buildChecklist({ ...empty, contactCount: 5 });
    expect(at5.items.find((i) => i.key === "contacts")?.done).toBe(false);
    const at6 = buildChecklist({ ...empty, contactCount: 6 });
    expect(at6.items.find((i) => i.key === "contacts")?.done).toBe(true);
  });

  it("completes fully with real activity", () => {
    const checklist = buildChecklist({
      whatsappConnected: true,
      simulationMode: false,
      contactCount: 40,
      activeCampaignCount: 1,
      enabledAutomationCount: 1,
      knowledgeFactCount: 8,
      conversationCount: 3,
    });
    expect(checklist.completed).toBe(5);
    expect(checklist.allDone).toBe(true);
  });

  it("every item links somewhere actionable", () => {
    for (const item of buildChecklist(empty).items) {
      expect(item.href.startsWith("/")).toBe(true);
      expect(item.title.length).toBeGreaterThan(0);
      expect(item.description.length).toBeGreaterThan(0);
    }
  });
});

describe("buildAttentionQueue", () => {
  const full: AttentionQueueInput = {
    role: "OWNER",
    attentionOrder: [
      "payment",
      "booking",
      "unread",
      "owner-question",
      "handoff",
      "followup",
      "setup",
    ],
    handoffCount: 2,
    ownerQuestionCount: 3,
    unreadMessageCount: 8,
    pendingBookingCount: 4,
    pendingPaymentCount: 5,
    followupsEnabled: false,
    setupRemaining: 2,
  };

  it("keeps urgent handoffs first and uses the chosen outcome for the rest", () => {
    const queue = buildAttentionQueue(full);
    expect(queue.items.map((item) => item.kind)).toEqual([
      "handoff",
      "payment",
      "booking",
      "unread",
    ]);
    expect(queue.items[0]).toMatchObject({ urgent: true, count: 2 });
  });

  it("caps visible rows at four while exposing every matching area", () => {
    const queue = buildAttentionQueue(full);
    expect(queue.items).toHaveLength(4);
    expect(queue.totalCount).toBe(7);
    expect(queue.hiddenCount).toBe(3);
    expect(queue.hiddenItems?.map((item) => item.kind)).toEqual([
      "owner-question",
      "followup",
      "setup",
    ]);
    expect(queue.allClear).toBe(false);
  });

  it("does not expose admin-only work to an agent", () => {
    const queue = buildAttentionQueue({ ...full, role: "AGENT" });
    expect(queue.items.map((item) => item.kind)).toEqual(["handoff", "unread"]);
    expect(queue.totalCount).toBe(2);
    expect(queue.items.map((item) => item.kind)).not.toContain("owner-question");
    expect(queue.items.map((item) => item.kind)).not.toContain("booking");
    expect(queue.items.map((item) => item.kind)).not.toContain("payment");
    expect(queue.items.map((item) => item.kind)).not.toContain("followup");
    expect(queue.items.map((item) => item.kind)).not.toContain("setup");
  });

  it("returns a stable positive state when nothing needs action", () => {
    const queue = buildAttentionQueue({
      ...full,
      handoffCount: 0,
      ownerQuestionCount: 0,
      unreadMessageCount: 0,
      pendingBookingCount: 0,
      pendingPaymentCount: 0,
      followupsEnabled: true,
      setupRemaining: 0,
    });
    expect(queue).toEqual({
      items: [],
      totalCount: 0,
      hiddenCount: 0,
      allClear: true,
    });
  });

  it("clamps invalid negative counts instead of presenting impossible work", () => {
    const queue = buildAttentionQueue({
      ...full,
      handoffCount: -2,
      ownerQuestionCount: -1,
      unreadMessageCount: -8,
      pendingBookingCount: -4,
      pendingPaymentCount: -5,
      followupsEnabled: true,
      setupRemaining: -2,
    });
    expect(queue.allClear).toBe(true);
  });
});

describe("buildOperationsSummary", () => {
  it("returns honest, clamped operational counts", () => {
    expect(
      buildOperationsSummary({
        bookingsToday: 3,
        pendingBookings: 2,
        openConversations: 7,
        followUpsThisMonth: 12,
        pendingPayments: 4,
        pendingPaymentAmountMinor: 152_500,
      })
    ).toEqual([
      {
        key: "bookings",
        label: "Appointments today",
        value: 3,
        detailCount: 2,
        detailLabel: "requests to confirm",
        href: "/inbox",
      },
      {
        key: "conversations",
        label: "Open conversations",
        value: 7,
        href: "/inbox",
      },
      {
        key: "followups",
        label: "Follow-ups sent",
        value: 12,
        href: "/automations",
      },
      {
        key: "payments",
        label: "Payments awaiting",
        value: 4,
        amountMinor: 152_500,
        href: "/inbox",
      },
    ]);
  });

  it("clamps negative numbers to zero", () => {
    const summary = buildOperationsSummary({
      bookingsToday: -1,
      pendingBookings: -1,
      openConversations: -1,
      followUpsThisMonth: -1,
      pendingPayments: -1,
      pendingPaymentAmountMinor: -1,
    });
    expect(summary.every((item) => item.value === 0)).toBe(true);
    expect(summary[0]).toMatchObject({ detailCount: 0 });
    expect(summary[3]).toMatchObject({ amountMinor: 0 });
  });
});

describe("dayBoundsInTimezone", () => {
  it("returns the UTC bounds for the workspace's local calendar day", () => {
    const bounds = dayBoundsInTimezone(
      "Asia/Kolkata",
      new Date("2026-09-06T12:00:00.000Z")
    );
    expect(bounds.start.toISOString()).toBe("2026-09-05T18:30:00.000Z");
    expect(bounds.end.toISOString()).toBe("2026-09-06T18:30:00.000Z");
  });

  it("falls back to UTC for an invalid timezone", () => {
    const bounds = dayBoundsInTimezone(
      "not/a-timezone",
      new Date("2026-09-06T12:00:00.000Z")
    );
    expect(bounds.start.toISOString()).toBe("2026-09-06T00:00:00.000Z");
    expect(bounds.end.toISOString()).toBe("2026-09-07T00:00:00.000Z");
  });
});

describe("formatPercent", () => {
  it("renders a dash when there is no data", () => {
    expect(formatPercent(null)).toBe("—");
  });
  it("rounds to whole percentages", () => {
    expect(formatPercent(0.8)).toBe("80%");
    expect(formatPercent(0.005)).toBe("1%");
    expect(formatPercent(1)).toBe("100%");
    expect(formatPercent(0)).toBe("0%");
  });
});

describe("formatCount", () => {
  it("uses Indian digit grouping", () => {
    expect(formatCount(123456)).toBe("1,23,456");
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-07-02T12:00:00Z");

  it("handles missing dates", () => {
    expect(formatRelativeTime(null, now)).toBe("—");
    expect(formatRelativeTime(undefined, now)).toBe("—");
  });

  it("buckets into just now / minutes / hours / days", () => {
    expect(formatRelativeTime(new Date("2026-07-02T11:59:30Z"), now)).toBe(
      "just now"
    );
    expect(formatRelativeTime(new Date("2026-07-02T11:45:00Z"), now)).toBe(
      "15m ago"
    );
    expect(formatRelativeTime(new Date("2026-07-02T09:00:00Z"), now)).toBe(
      "3h ago"
    );
    expect(formatRelativeTime(new Date("2026-06-30T12:00:00Z"), now)).toBe(
      "2d ago"
    );
  });

  it("falls back to an en-IN date beyond a week", () => {
    const result = formatRelativeTime(new Date("2026-06-01T12:00:00Z"), now);
    expect(result).toMatch(/Jun/);
  });
});

describe("greetingForHour", () => {
  it("morning / afternoon / evening boundaries", () => {
    expect(greetingForHour(5)).toBe("Good morning");
    expect(greetingForHour(11)).toBe("Good morning");
    expect(greetingForHour(12)).toBe("Good afternoon");
    expect(greetingForHour(16)).toBe("Good afternoon");
    expect(greetingForHour(17)).toBe("Good evening");
    expect(greetingForHour(23)).toBe("Good evening");
    expect(greetingForHour(2)).toBe("Good evening");
  });
});
