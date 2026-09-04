import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * E2 custom agent actions — the safety contract:
 *  - model input is validated against the org-authored JSON schema
 *  - simulated orgs NEVER make network calls (invariant 4)
 *  - the SSRF guard blocks private/reserved addresses (reused verbatim)
 *  - responses are truncated before reaching the model
 *  - every failure is an isError result string, never a throw
 *  - orgs without the customActions plan flag load no custom tools
 */

const { prisma } = vi.hoisted(() => ({
  prisma: {
    org: { findUnique: vi.fn() },
    customAction: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/env", () => ({
  env: { SEND_MODE: "live", TOKEN_ENCRYPTION_KEY: "x".repeat(32) },
}));

import {
  validateCustomInput,
  loadCustomTools,
  RESPONSE_CAP,
} from "@/modules/agent/tools/custom";
import { runTool, toolDefs } from "@/modules/agent/tools";

const ctx = {
  orgId: "org1",
  contactId: "c1",
  conversationId: "cv1",
  contactName: "Priya",
  contactPhone: "+919876543210",
};

const ACTION = {
  id: "a1",
  orgId: "org1",
  name: "check_order_status",
  description: "Look up the status of a customer's order by order id.",
  inputSchema: {
    type: "object",
    properties: { order_id: { type: "string" } },
    required: ["order_id"],
  },
  url: "https://93.184.216.34/api/orders", // literal public IP: SSRF guard checks it without DNS
  method: "POST",
  secretEncrypted: null,
  timeoutMs: 8000,
  enabled: true,
};

const ENTERPRISE_ORG = { id: "org1", plan: "enterprise", simulated: false };

beforeEach(() => {
  vi.restoreAllMocks();
  prisma.org.findUnique.mockResolvedValue(ENTERPRISE_ORG);
  prisma.customAction.findMany.mockResolvedValue([ACTION]);
});

describe("validateCustomInput", () => {
  const schema = ACTION.inputSchema;
  it("accepts input matching the schema", () => {
    expect(validateCustomInput(schema, { order_id: "123" })).toBeNull();
  });
  it("rejects missing required fields with a readable message", () => {
    const err = validateCustomInput(schema, {});
    expect(err).toContain("order_id");
  });
  it("rejects wrong primitive types", () => {
    expect(validateCustomInput(schema, { order_id: 42 })).toContain("order_id");
  });
  it("rejects non-object input", () => {
    expect(validateCustomInput(schema, "hello")).toBeTruthy();
  });
});

describe("loadCustomTools — plan gate", () => {
  it("returns nothing for a plan without the customActions flag", async () => {
    prisma.org.findUnique.mockResolvedValue({ id: "org1", plan: "growth", simulated: false });
    expect(await loadCustomTools("org1")).toEqual([]);
    expect(prisma.customAction.findMany).not.toHaveBeenCalled();
  });

  it("skips a custom action whose name collides with a built-in", async () => {
    prisma.customAction.findMany.mockResolvedValue([
      { ...ACTION, name: "capture_lead" },
      ACTION,
    ]);
    const tools = await loadCustomTools("org1");
    expect(tools.map((t) => t.def.name)).toEqual(["check_order_status"]);
  });

  it("advertises the action to the model with its schema", async () => {
    const [tool] = await loadCustomTools("org1");
    expect(tool.def.name).toBe("check_order_status");
    expect(tool.def.description).toContain("order");
    expect(tool.def.input_schema.type).toBe("object");
  });
});

describe("execution — simulation (invariant 4)", () => {
  it("echoes without any network call for a simulated org", async () => {
    prisma.org.findUnique.mockResolvedValue({ id: "org1", plan: "enterprise", simulated: true });
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const [tool] = await loadCustomTools("org1");
    const r = await tool.parseAndRun(ctx, { order_id: "123" });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(r.isError).toBeUndefined();
    expect(r.result).toContain("simulated");
    expect(r.result).toContain("123");
  });
});

describe("execution — live", () => {
  it("blocks a URL pointing at a private address (SSRF)", async () => {
    prisma.customAction.findMany.mockResolvedValue([
      { ...ACTION, url: "https://10.0.0.8/internal" },
    ]);
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const [tool] = await loadCustomTools("org1");
    const r = await tool.parseAndRun(ctx, { order_id: "123" });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(r.isError).toBe(true);
  });

  it("calls the endpoint and returns the (truncated) body", async () => {
    const big = "x".repeat(RESPONSE_CAP * 2);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(big, { status: 200 })
    );
    const [tool] = await loadCustomTools("org1");
    const r = await tool.parseAndRun(ctx, { order_id: "123" });
    expect(r.isError).toBeUndefined();
    expect(r.result.length).toBeLessThanOrEqual(RESPONSE_CAP + 100);
  });

  it("turns a network failure into a recoverable isError result", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("boom"));
    const [tool] = await loadCustomTools("org1");
    const r = await tool.parseAndRun(ctx, { order_id: "123" });
    expect(r.isError).toBe(true);
    expect(r.result).toMatch(/could not|couldn't|unavailable/i);
  });

  it("turns a non-2xx response into an isError result", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("nope", { status: 500 })
    );
    const [tool] = await loadCustomTools("org1");
    const r = await tool.parseAndRun(ctx, { order_id: "123" });
    expect(r.isError).toBe(true);
  });
});

describe("registry integration", () => {
  it("runTool dispatches to a passed-in custom tool", async () => {
    prisma.org.findUnique.mockResolvedValue({ id: "org1", plan: "enterprise", simulated: true });
    const customs = await loadCustomTools("org1");
    const r = await runTool(ctx, { name: "check_order_status", input: { order_id: "9" } }, customs);
    expect(r.isError).toBeUndefined();
    expect(r.result).toContain("simulated");
  });

  it("built-in defs are unchanged (voice bridge safety)", () => {
    expect(toolDefs().map((t) => t.name)).toContain("capture_lead");
  });
});
