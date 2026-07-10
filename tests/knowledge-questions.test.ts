import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirst = vi.fn();
const update = vi.fn().mockResolvedValue({});
const create = vi.fn().mockResolvedValue({ id: "q1" });

vi.mock("@/lib/db", () => ({
  prisma: {
    ownerQuestion: {
      findFirst: (...a: unknown[]) => findFirst(...a),
      update: (...a: unknown[]) => update(...a),
      create: (...a: unknown[]) => create(...a),
    },
  },
}));
// answerOwnerQuestion pulls auth (supabase) + followups (messaging); stub the
// module boundary so this file stays a pure unit test of the ask path.
vi.mock("@/modules/orgs/auth", () => ({
  requireRole: vi.fn(),
}));
vi.mock("@/modules/knowledge/followups", () => ({
  sendKnowledgeFollowUps: vi.fn().mockResolvedValue({ sent: 0, waiting: [] }),
}));

import {
  appendWaiter,
  askOwner,
  parseWaiting,
  type Waiter,
} from "@/modules/knowledge/questions";

const w = (conversationId: string): Waiter => ({
  conversationId,
  contactId: `c-${conversationId}`,
  askedAt: "2026-07-14T10:00:00Z",
});

describe("parseWaiting (defensive Json parse)", () => {
  it("passes valid arrays through", () => {
    expect(parseWaiting([w("a")])).toEqual([w("a")]);
  });
  it("garbage → empty", () => {
    expect(parseWaiting(null)).toEqual([]);
    expect(parseWaiting("x")).toEqual([]);
    expect(parseWaiting([{ nope: 1 }, w("b")])).toEqual([w("b")]);
  });
});

describe("appendWaiter", () => {
  it("appends new conversations, preserves order", () => {
    expect(appendWaiter([w("a")], w("b")).map((x) => x.conversationId)).toEqual(
      ["a", "b"]
    );
  });
  it("never duplicates a conversation", () => {
    expect(appendWaiter([w("a")], w("a"))).toHaveLength(1);
  });
});

describe("askOwner (dedupe on normalized question key)", () => {
  const ctx = { orgId: "org1", conversationId: "cv9", contactId: "c9" };

  beforeEach(() => {
    findFirst.mockReset();
    update.mockClear();
    create.mockClear();
  });

  it("creates a pending question the first time", async () => {
    findFirst.mockResolvedValue(null);
    const r = await askOwner(ctx, "Do you have chicken?");
    expect(r.status).toBe("queued");
    expect(create).toHaveBeenCalledOnce();
    const data = create.mock.calls[0][0].data;
    expect(data.orgId).toBe("org1");
    expect(data.questionKey).toBe("chicken");
    expect(data.waiting[0].conversationId).toBe("cv9");
    expect(update).not.toHaveBeenCalled();
  });

  it("a second phrasing joins the existing question instead of creating", async () => {
    findFirst.mockResolvedValue({
      id: "q1",
      waiting: [w("other-convo")],
    });
    const r = await askOwner(ctx, "Is there CHICKEN?!");
    expect(r.status).toBe("already_queued");
    expect(create).not.toHaveBeenCalled();
    const data = update.mock.calls[0][0].data;
    expect(data.askCount).toEqual({ increment: 1 });
    expect(data.waiting.map((x: Waiter) => x.conversationId)).toEqual([
      "other-convo",
      "cv9",
    ]);
  });
});
