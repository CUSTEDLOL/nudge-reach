import { describe, expect, it } from "vitest";
import {
  buildConversationWhere,
  parseInboxFilter,
} from "@/lib/inbox/filters";
import {
  firstName,
  formatDayLabel,
  formatRelativeTime,
  serviceWindowState,
  toPreview,
} from "@/lib/inbox/format";

const ORG = "org_1";
const ME = "user_me";

describe("parseInboxFilter", () => {
  it("accepts every known filter", () => {
    for (const f of ["all", "open", "mine", "unassigned", "resolved", "unread"]) {
      expect(parseInboxFilter(f)).toBe(f);
    }
  });
  it("defaults unknown / missing values to open", () => {
    expect(parseInboxFilter(undefined)).toBe("open");
    expect(parseInboxFilter("bogus")).toBe("open");
  });
});

describe("buildConversationWhere (spec §M2 filters)", () => {
  it("always scopes to the org", () => {
    for (const f of ["all", "open", "mine", "unassigned", "resolved", "unread"] as const) {
      expect(buildConversationWhere(ORG, f, "", ME).orgId).toBe(ORG);
    }
  });

  it("open includes handoff (shows the Needs-human badge under Open)", () => {
    const where = buildConversationWhere(ORG, "open", "", ME);
    expect(where.status).toEqual({ in: ["open", "handoff"] });
  });

  it("resolved treats legacy closed rows as resolved", () => {
    const where = buildConversationWhere(ORG, "resolved", "", ME);
    expect(where.status).toEqual({ in: ["resolved", "closed"] });
  });

  it("mine = assigned to the caller, not yet resolved", () => {
    const where = buildConversationWhere(ORG, "mine", "", ME);
    expect(where.assignedToUserId).toBe(ME);
    expect(where.status).toEqual({ notIn: ["resolved", "closed"] });
  });

  it("unassigned = no assignee, not yet resolved", () => {
    const where = buildConversationWhere(ORG, "unassigned", "", ME);
    expect(where.assignedToUserId).toBeNull();
    expect(where.status).toEqual({ notIn: ["resolved", "closed"] });
  });

  it("unread = unreadCount > 0", () => {
    const where = buildConversationWhere(ORG, "unread", "", ME);
    expect(where.unreadCount).toEqual({ gt: 0 });
  });

  it("all adds no status constraint", () => {
    const where = buildConversationWhere(ORG, "all", "", ME);
    expect(where.status).toBeUndefined();
    expect(where.unreadCount).toBeUndefined();
    expect(where.assignedToUserId).toBeUndefined();
  });

  it("search matches contact name, phone and last-message preview", () => {
    const where = buildConversationWhere(ORG, "all", "priya", ME);
    expect(where.OR).toEqual([
      { contact: { name: { contains: "priya", mode: "insensitive" } } },
      { contact: { phoneE164: { contains: "priya" } } },
      { lastMessagePreview: { contains: "priya", mode: "insensitive" } },
    ]);
  });

  it("blank search adds no OR clause", () => {
    expect(buildConversationWhere(ORG, "all", "   ", ME).OR).toBeUndefined();
  });
});

describe("serviceWindowState (24h window, mirrors lib/agent/window)", () => {
  const now = new Date("2026-06-30T12:00:00Z").getTime();

  it("is closed with no inbound ever", () => {
    expect(serviceWindowState(null, now)).toEqual({ open: false, label: null });
  });

  it("is open with a countdown inside 24h", () => {
    const state = serviceWindowState("2026-06-30T10:30:00Z", now);
    expect(state.open).toBe(true);
    expect(state.label).toBe("22h 30m left");
  });

  it("shows minutes only in the final hour", () => {
    const state = serviceWindowState("2026-06-29T12:45:00Z", now);
    expect(state.open).toBe(true);
    expect(state.label).toBe("45m left");
  });

  it("is closed just past 24h", () => {
    const state = serviceWindowState("2026-06-29T11:59:00Z", now);
    expect(state.open).toBe(false);
  });
});

describe("format helpers", () => {
  const now = new Date("2026-06-30T12:00:00Z").getTime();

  it("formatRelativeTime buckets", () => {
    expect(formatRelativeTime(null, now)).toBe("");
    expect(formatRelativeTime("2026-06-30T11:59:40Z", now)).toBe("now");
    expect(formatRelativeTime("2026-06-30T11:45:00Z", now)).toBe("15m");
    expect(formatRelativeTime("2026-06-30T07:00:00Z", now)).toBe("5h");
    expect(formatRelativeTime("2026-06-28T12:00:00Z", now)).toBe("2d");
  });

  it("formatDayLabel says Today/Yesterday", () => {
    const ref = new Date(2026, 5, 30, 12, 0);
    expect(formatDayLabel(new Date(2026, 5, 30, 1, 0).toISOString(), ref)).toBe("Today");
    expect(formatDayLabel(new Date(2026, 5, 29, 23, 0).toISOString(), ref)).toBe("Yesterday");
  });

  it("firstName takes the first token", () => {
    expect(firstName("Priya Sharma")).toBe("Priya");
    expect(firstName("  Arjun  ")).toBe("Arjun");
  });

  it("toPreview flattens whitespace and truncates at 120 chars", () => {
    expect(toPreview("hello\nworld")).toBe("hello world");
    const long = "x".repeat(200);
    const preview = toPreview(long);
    expect(preview.length).toBe(120);
    expect(preview.endsWith("…")).toBe(true);
  });
});
