import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * One customer's message must never take down the batch.
 *
 * Meta can deliver several messages in one webhook call. Nothing used to
 * guard `handleInboundMessage`, so a single failure — a provider outage, a
 * bad BYOK model id, one malformed contact row — threw out of POST, 500'd the
 * whole request, left `webhookEvent.processedAt` unset, dropped every other
 * customer in the same batch, and made Meta redeliver the lot.
 *
 * The agent already answers with the handoff line when the model itself
 * fails (agent-provider-failure.test.ts); this is the backstop for everything
 * else in the pipeline.
 */

const SECRET = "test-app-secret";
vi.mock("@/lib/env", () => ({
  env: { META_APP_SECRET: "test-app-secret", WHATSAPP_WEBHOOK_VERIFY_TOKEN: "vt" },
}));

const { handleInboundMessage, eventUpdate } = vi.hoisted(() => ({
  handleInboundMessage: vi.fn(),
  eventUpdate: vi.fn(async () => ({})),
}));
vi.mock("@/modules/agent/inbound", () => ({ handleInboundMessage }));

vi.mock("@/lib/db", () => ({
  prisma: {
    webhookEvent: { create: vi.fn(async () => ({ id: "evt" })), update: eventUpdate },
    whatsappAccount: { findFirst: vi.fn(async () => ({ id: "wa1", orgId: "org-a" })) },
    conversationMessage: { findFirst: vi.fn(async () => null) },
    message: { findFirst: vi.fn(async () => null) },
  },
}));

import { POST } from "@/app/api/webhooks/whatsapp/route";

function signed(body: string) {
  const sig = "sha256=" + crypto.createHmac("sha256", SECRET).update(body).digest("hex");
  return new Request("http://localhost/api/webhooks/whatsapp", {
    method: "POST",
    body,
    headers: { "content-type": "application/json", "x-hub-signature-256": sig },
  });
}

/** Two customers in one delivery, which is how Meta batches under load. */
const batch = JSON.stringify({
  object: "whatsapp_business_account",
  entry: [
    {
      id: "waba-1",
      changes: [
        {
          field: "messages",
          value: {
            metadata: { phone_number_id: "111" },
            messages: [
              { id: "wamid.A", from: "919000000001", type: "text", text: { body: "hi" } },
              { id: "wamid.B", from: "919000000002", type: "text", text: { body: "prices?" } },
            ],
          },
        },
      ],
    },
  ],
});

beforeEach(() => {
  vi.clearAllMocks();
  handleInboundMessage.mockResolvedValue({ optedOut: false });
});

describe("WhatsApp webhook — one bad message cannot break the batch", () => {
  it("returns 200 even when processing a message throws", async () => {
    handleInboundMessage.mockRejectedValue(new Error("provider exploded"));
    // A non-200 makes Meta redeliver, so the same failure would loop forever.
    expect((await POST(signed(batch))).status).toBe(200);
  });

  it("still processes the second customer when the first one fails", async () => {
    handleInboundMessage
      .mockRejectedValueOnce(new Error("provider exploded"))
      .mockResolvedValueOnce({ optedOut: false });

    await POST(signed(batch));

    expect(handleInboundMessage).toHaveBeenCalledTimes(2);
    expect(handleInboundMessage.mock.calls[1][1]).toBe("919000000002");
  });

  it("marks the webhook event processed even after a failure", async () => {
    handleInboundMessage.mockRejectedValue(new Error("provider exploded"));
    await POST(signed(batch));
    expect(eventUpdate).toHaveBeenCalled();
  });

  it("the happy path is unchanged", async () => {
    const res = await POST(signed(batch));
    expect(res.status).toBe(200);
    expect(handleInboundMessage).toHaveBeenCalledTimes(2);
  });
});
