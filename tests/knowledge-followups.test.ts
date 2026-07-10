import { describe, expect, it } from "vitest";
import {
  buildFollowUpText,
  eligibleWaiters,
} from "@/modules/knowledge/followups";
import type { Waiter } from "@/modules/knowledge/questions";

describe("buildFollowUpText", () => {
  it("answers from the facts, rendering conditions", () => {
    const t = buildFollowUpText([
      {
        category: "menu_services",
        fact: "Chicken dishes are served",
        condition: "weekends only",
      },
    ]);
    expect(t).toContain("checked with the team");
    expect(t).toContain("Chicken dishes are served");
    expect(t).toContain("weekends only");
  });

  it("caps at three facts", () => {
    const t = buildFollowUpText(
      Array.from({ length: 6 }, (_, i) => ({
        category: "other" as const,
        fact: `Fact ${i}`,
      }))
    );
    expect(t).toContain("Fact 2");
    expect(t).not.toContain("Fact 3");
  });
});

describe("eligibleWaiters", () => {
  const now = new Date("2026-07-14T12:00:00Z");
  const w = (conversationId: string, followedUpAt?: string): Waiter => ({
    conversationId,
    contactId: `contact-${conversationId}`,
    askedAt: "2026-07-14T10:00:00Z",
    ...(followedUpAt ? { followedUpAt } : {}),
  });

  it("keeps waiters whose conversation is inside the 24h window", () => {
    const lastInbound = new Map<string, Date | null>([
      ["a", new Date("2026-07-14T11:30:00Z")], // 30 min ago — in window
      ["b", new Date("2026-07-13T11:00:00Z")], // 25h ago — window closed
      ["c", null], // never inbound — closed
    ]);
    const kept = eligibleWaiters([w("a"), w("b"), w("c")], lastInbound, now);
    expect(kept.map((x) => x.conversationId)).toEqual(["a"]);
  });

  it("skips already-followed-up waiters", () => {
    const lastInbound = new Map<string, Date | null>([
      ["a", new Date("2026-07-14T11:30:00Z")],
    ]);
    expect(
      eligibleWaiters([w("a", "2026-07-14T11:45:00Z")], lastInbound, now)
    ).toEqual([]);
  });

  it("window edge: 23h59m in, 24h01m out", () => {
    const lastInbound = new Map<string, Date | null>([
      ["in", new Date("2026-07-13T12:01:00Z")],
      ["out", new Date("2026-07-13T11:59:00Z")],
    ]);
    const kept = eligibleWaiters([w("in"), w("out")], lastInbound, now);
    expect(kept.map((x) => x.conversationId)).toEqual(["in"]);
  });
});
