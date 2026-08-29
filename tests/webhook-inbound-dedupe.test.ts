import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Meta redelivers a webhook it considers failed (our reply took too long, or a
 * non-200 slipped out). The same inbound `wamid` must produce ONE agent reply,
 * never two — a duplicate reply to a customer is the most visible way to look
 * broken on day one.
 */

const SECRET = "test-app-secret";
vi.mock("@/lib/env", () => ({
  env: { META_APP_SECRET: "test-app-secret", WHATSAPP_WEBHOOK_VERIFY_TOKEN: "vt" },
}));

// vi.mock factories are hoisted above imports, so shared state lives in vi.hoisted.
const { seenInbound, handleInboundMessage } = vi.hoisted(() => {
  const seenInbound = new Set<string>();
  const handleInboundMessage = vi.fn(
    async (_orgId: string, _from: string, _text: string, opts?: { metaMessageId?: string }) => {
      if (opts?.metaMessageId) seenInbound.add(opts.metaMessageId);
      return { optedOut: false };
    }
  );
  return { seenInbound, handleInboundMessage };
});
vi.mock("@/modules/agent/inbound", () => ({ handleInboundMessage }));

vi.mock("@/lib/db", () => ({
  prisma: {
    webhookEvent: {
      create: vi.fn(async () => ({ id: "evt" })),
      update: vi.fn(async () => ({})),
    },
    whatsappAccount: {
      findFirst: vi.fn(async ({ where }: { where: { phoneNumberId?: string } }) =>
        where.phoneNumberId === "111" ? { orgId: "org-a" } : null
      ),
    },
    conversationMessage: {
      // The dedupe lookup: "have we stored an inbound row with this wamid?"
      findFirst: vi.fn(async ({ where }: { where: { metaMessageId: string } }) =>
        seenInbound.has(where.metaMessageId) ? { id: "existing" } : null
      ),
    },
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

const inbound = (id: string, from = "919876543210", text = "hi, table for 2?") =>
  JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "waba-1",
        changes: [
          {
            field: "messages",
            value: {
              metadata: { phone_number_id: "111" },
              messages: [{ id, from, type: "text", text: { body: text } }],
            },
          },
        ],
      },
    ],
  });

beforeEach(() => {
  seenInbound.clear();
  handleInboundMessage.mockClear();
});

describe("WhatsApp webhook — inbound redelivery", () => {
  it("processes a message once even when Meta delivers it twice", async () => {
    const body = inbound("wamid.SAME");
    expect((await POST(signed(body))).status).toBe(200);
    expect((await POST(signed(body))).status).toBe(200);
    expect(handleInboundMessage).toHaveBeenCalledTimes(1);
    expect(handleInboundMessage.mock.calls[0][3]).toEqual({ metaMessageId: "wamid.SAME" });
  });

  it("still processes distinct messages from the same customer", async () => {
    await POST(signed(inbound("wamid.ONE")));
    await POST(signed(inbound("wamid.TWO", "919876543210", "and parking?")));
    expect(handleInboundMessage).toHaveBeenCalledTimes(2);
  });

  it("ignores messages for a phone number no org owns", async () => {
    const body = inbound("wamid.X").replace('"phone_number_id":"111"', '"phone_number_id":"999"');
    expect((await POST(signed(body))).status).toBe(200);
    expect(handleInboundMessage).not.toHaveBeenCalled();
  });
});
