import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
const oqFindFirst = vi.fn();
const oqCreate = vi.fn().mockResolvedValue({ id: "q1" });
const oqUpdate = vi.fn().mockResolvedValue({});

vi.mock("@/lib/db", () => ({
  prisma: {
    knowledgeEntry: { findMany: (...a: unknown[]) => findMany(...a) },
    ownerQuestion: {
      findFirst: (...a: unknown[]) => oqFindFirst(...a),
      create: (...a: unknown[]) => oqCreate(...a),
      update: (...a: unknown[]) => oqUpdate(...a),
    },
    // Unused by ask_owner but pulled in by the tool registry:
    conversation: { update: vi.fn().mockResolvedValue({}) },
    contact: { update: vi.fn().mockResolvedValue({}) },
    note: { create: vi.fn().mockResolvedValue({}) },
    bookingRequest: { create: vi.fn().mockResolvedValue({ id: "b1" }) },
    calendarAccount: { findUnique: vi.fn().mockResolvedValue(null) },
  },
}));

import { findKnownFact } from "@/modules/agent/tools/ask-owner";
import { runTool } from "@/modules/agent/tools";

const ctx = {
  orgId: "org1",
  contactId: "c1",
  conversationId: "cv1",
  contactName: "Priya",
  contactPhone: "+919810000000",
};

const chickenFact = {
  category: "menu_services",
  fact: "Chicken dishes are served",
  condition: "weekends only",
};

describe("findKnownFact (pure)", () => {
  it("matches a question against an existing fact", () => {
    expect(findKnownFact([chickenFact], "Do you have chicken?")).toBe(
      chickenFact
    );
  });
  it("misses when the fact doesn't cover it", () => {
    expect(findKnownFact([chickenFact], "Is there parking?")).toBeNull();
  });
  it("no qualifying tokens → null (never a false positive)", () => {
    expect(findKnownFact([chickenFact], "is it ok")).toBeNull();
  });
});

describe("ask_owner tool", () => {
  beforeEach(() => {
    findMany.mockReset();
    oqFindFirst.mockReset();
    oqCreate.mockClear();
    oqUpdate.mockClear();
  });

  it("short-circuits with KNOWN when the knowledge base covers it", async () => {
    findMany.mockResolvedValue([chickenFact]);
    const r = await runTool(ctx, {
      name: "ask_owner",
      input: { question: "Do you have chicken dishes?" },
    });
    expect(r.isError).toBeUndefined();
    expect(r.result).toContain("KNOWN");
    expect(r.result).toContain("weekends only");
    expect(oqCreate).not.toHaveBeenCalled();
  });

  it("queues an owner question when unknown", async () => {
    findMany.mockResolvedValue([]);
    oqFindFirst.mockResolvedValue(null);
    const r = await runTool(ctx, {
      name: "ask_owner",
      input: { question: "Do you do home delivery to Gurgaon?" },
    });
    expect(r.result).toContain("QUEUED");
    expect(oqCreate).toHaveBeenCalledOnce();
  });

  it("rejects invalid input as a recoverable error", async () => {
    const r = await runTool(ctx, { name: "ask_owner", input: { question: "x" } });
    expect(r.isError).toBe(true);
  });
});
