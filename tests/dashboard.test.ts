import { describe, expect, it } from "vitest";
import {
  buildChecklist,
  computeMessageRates,
  estimateRevenueInfluencedInr,
  parseAvgOrderValueInr,
  DEFAULT_AVG_ORDER_VALUE_INR,
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
