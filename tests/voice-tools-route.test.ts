import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ env: { VOICE_TOOLS_SECRET: "tool-secret", SEND_MODE: "live" } }));
const runTool = vi.hoisted(() =>
  vi.fn(async (_ctx: unknown, call: { name: string }) => ({ result: `ran ${call.name}` }))
);
vi.mock("@/modules/agent/tools", () => ({ runTool }));
vi.mock("@/lib/db", () => ({
  prisma: {
    contact: { upsert: vi.fn(async () => ({ id: "c1", name: "+919876543210" })) },
    conversation: { upsert: vi.fn(async () => ({ id: "cv1" })) },
  },
}));

import { POST } from "@/app/api/voice/tools/[tool]/route";

const call = (tool: string, body: unknown, auth = "Bearer tool-secret") =>
  POST(
    new Request(`http://localhost/api/voice/tools/${tool}`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { authorization: auth, "content-type": "application/json" },
    }),
    { params: Promise.resolve({ tool }) }
  );

describe("POST /api/voice/tools/[tool]", () => {
  it("runs an allowed tool scoped to the org + caller", async () => {
    const res = await call("capture_booking_request", {
      org_id: "org1", contact_phone: "+919876543210", name: "Priya", requested_for: "tomorrow 5pm",
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ result: "ran capture_booking_request" });
    expect(runTool).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: "org1", contactId: "c1", conversationId: "cv1", contactPhone: "+919876543210" }),
      { name: "capture_booking_request", input: { name: "Priya", requested_for: "tomorrow 5pm" } }
    );
  });
  it("rejects bad auth and unknown tools", async () => {
    expect((await call("capture_lead", { org_id: "o", contact_phone: "+91" }, "Bearer nope")).status).toBe(401);
    expect((await call("delete_everything", { org_id: "o", contact_phone: "+91" })).status).toBe(404);
  });
});
