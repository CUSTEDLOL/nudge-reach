import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * When the AI provider fails — revoked key, outage, a BYOK model id the
 * provider rejects — the customer must still hear something and a human must
 * be flagged in. Previously only CreditsExhaustedError was caught: anything
 * else propagated out of the agent, out of `handleInboundMessage`, and 500'd
 * the WhatsApp webhook, so the customer got silence and Meta retried.
 *
 * Silence is the worst possible failure for a front desk — it happens on
 * exactly the leads we are paid to catch, and it is invisible to the owner.
 */

const { chat, runAgent, generate, loadCustomTools } = vi.hoisted(() => ({
  chat: vi.fn(),
  runAgent: vi.fn(),
  generate: vi.fn(),
  loadCustomTools: vi.fn(),
}));

vi.mock("@/lib/model-router", () => ({ chat, runAgent, generate }));
vi.mock("@/modules/agent/tools/custom", () => ({ loadCustomTools }));

import { generateAgentActionReply, generateAgentReply } from "@/modules/agent/reply";
import { CreditsExhaustedError } from "@/modules/billing/credits";

const PROFILE = {
  vertical: "clinic",
  businessName: "Radiance Clinic",
  businessInfo: "Open Mon–Sat.",
  tone: "Warm",
  doNots: "",
};
const HISTORY = [{ role: "user" as const, text: "do you do hair transplants?" }];
const CTX = { orgId: "org1", conversationId: "c1" };

const FALLBACK = "Thanks for your message! One of our team will get back to you shortly. 🙏";

beforeEach(() => {
  vi.clearAllMocks();
  loadCustomTools.mockResolvedValue([]);
});

describe("the agent never leaves a customer unanswered", () => {
  it("falls back instead of throwing when the provider errors mid-reply", async () => {
    runAgent.mockRejectedValue(new Error("404 model not found: gemini-3-pro"));

    const reply = await generateAgentActionReply(PROFILE, HISTORY, CTX as never);

    expect(reply.text).toBe(FALLBACK);
    expect(reply.handoff).toBe(true);
    // Flagged so the owner can be told, and so it is distinguishable from a
    // normal handoff the agent chose to make. Shares upstream's `aiFailed`
    // name (9b1734d) rather than inventing a second flag for the same thing.
    expect(reply.aiFailed).toBe(true);
    expect(reply.pausedForCredits).toBeFalsy();
  });

  it("falls back when the plain (tool-less) reply path errors", async () => {
    chat.mockRejectedValue(new Error("401 invalid api key"));

    const reply = await generateAgentReply(PROFILE, HISTORY, CTX);

    expect(reply.text).toBe(FALLBACK);
    expect(reply.handoff).toBe(true);
    expect(reply.aiFailed).toBe(true);
  });

  it("still reports a zero credit balance as its own distinct case", async () => {
    runAgent.mockRejectedValue(new CreditsExhaustedError("org1"));

    const reply = await generateAgentActionReply(PROFILE, HISTORY, CTX as never);

    expect(reply.text).toBe(FALLBACK);
    expect(reply.pausedForCredits).toBe(true);
    // Out of credits is a billing state, not a provider outage.
    expect(reply.aiFailed).toBeFalsy();
  });

  it("a healthy reply is not marked as a failure", async () => {
    runAgent.mockResolvedValue({ text: "Yes, we do.", toolCalls: [], cappedOut: false });

    const reply = await generateAgentActionReply(PROFILE, HISTORY, CTX as never);

    expect(reply.text).toBe("Yes, we do.");
    expect(reply.aiFailed).toBeFalsy();
    expect(reply.handoff).toBe(false);
  });
});
