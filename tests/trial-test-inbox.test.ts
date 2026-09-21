import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TestConversation } from "@/components/features/trial/test-conversation";
import {
  createTrialTestInboxState,
  reduceTrialTestInbox,
  trialConversationDestination,
  trialTestIdentity,
} from "@/modules/trial/test-inbox";

const activeTrial = {
  status: "active" as const,
  repliesUsed: 0,
  replyLimit: 15,
  repliesRemaining: 15,
};

describe("trial test inbox state", () => {
  it("replaces the optimistic customer message with the shared thread snapshot", () => {
    const initial = createTrialTestInboxState(activeTrial);
    const sent = reduceTrialTestInbox(initial, {
      type: "sent",
      body: "Are you open Sunday?",
    });
    const replied = reduceTrialTestInbox(sent, {
      type: "snapshot",
      messages: [
        {
          id: "message_1",
          direction: "inbound",
          body: "Are you open Sunday?",
          createdAt: "2026-09-21T09:00:00.000Z",
          metaMessageId: null,
        },
        {
          id: "message_2",
          direction: "outbound",
          body: "We are closed on Sunday.",
          createdAt: "2026-09-21T09:00:01.000Z",
          metaMessageId: "wamid_1",
        },
      ],
      trial: { ...activeTrial, repliesUsed: 1, repliesRemaining: 14 },
    });

    expect(replied.messages.map((message) => message.body)).toEqual([
      "Are you open Sunday?",
      "We are closed on Sunday.",
    ]);
    expect(replied.messages.map((message) => message.speaker)).toEqual([
      "customer",
      "nudge",
    ]);
    expect(replied.repliesRemaining).toBe(14);
    expect(replied.announcement).toBe("We are closed on Sunday.");
    expect(replied.composerEnabled).toBe(true);
  });

  it.each(["expired", "exhausted"] as const)(
    "disables the composer when the trial is %s",
    (status) => {
      const state = createTrialTestInboxState({
        ...activeTrial,
        status,
        repliesUsed: status === "exhausted" ? 15 : 3,
        repliesRemaining: status === "exhausted" ? 0 : 12,
      });

      expect(state.composerEnabled).toBe(false);
    },
  );

  it("keeps one private test identity stable per organization", () => {
    expect(trialTestIdentity()).toEqual({
      label: "Test customer · private simulation",
    });
  });

  it("hydrates persisted history and preserves an optimistic message if refresh fails", () => {
    const persisted = [{
      id: "message_1",
      direction: "inbound",
      body: "What are your timings?",
      createdAt: "2026-09-21T09:00:00.000Z",
      metaMessageId: null,
    }];
    const initial = createTrialTestInboxState(activeTrial, persisted);
    const sent = reduceTrialTestInbox(initial, {
      type: "sent",
      body: "What about Sunday?",
    });
    const refreshFailed = reduceTrialTestInbox(sent, { type: "snapshot_failed" });

    expect(initial.messages.map((message) => message.body)).toEqual([
      "What are your timings?",
    ]);
    expect(refreshFailed.messages.at(-1)).toMatchObject({
      body: "What about Sunday?",
      optimistic: true,
    });
    expect(refreshFailed.composerEnabled).toBe(true);
  });

  it("uses the action's authoritative stopped state when snapshot refresh fails", () => {
    const sent = reduceTrialTestInbox(createTrialTestInboxState(activeTrial), {
      type: "sent",
      body: "Question fifteen",
    });
    const refreshFailed = reduceTrialTestInbox(sent, {
      type: "snapshot_failed",
      trial: {
        ...activeTrial,
        status: "exhausted",
        repliesUsed: 15,
        repliesRemaining: 0,
      },
    });

    expect(refreshFailed.repliesRemaining).toBe(0);
    expect(refreshFailed.composerEnabled).toBe(false);
    expect(refreshFailed.messages.at(-1)?.body).toBe("Question fifteen");
  });

  it("redirects standard workspaces but keeps acquisition trials inline", () => {
    expect(trialConversationDestination(false, "conversation_1")).toBe(
      "/inbox/conversation_1",
    );
    expect(trialConversationDestination(true, "conversation_1")).toBeNull();
  });
});

describe("trial test conversation", () => {
  it("renders the private identity, live reply region, and conversion actions", () => {
    const state = createTrialTestInboxState({
      ...activeTrial,
      status: "exhausted",
      repliesUsed: 15,
      repliesRemaining: 0,
    });
    const html = renderToStaticMarkup(
      createElement(TestConversation, {
        state,
        identityLabel: "Test customer · private simulation",
        conversationId: "conversation_1",
      }),
    );

    expect(html).toContain("Your private test inbox");
    expect(html).toContain("Test customer · private simulation");
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Book a free demo");
    expect(html).toContain('href="/pricing"');
    expect(html).toContain('href="/inbox/conversation_1"');
    expect(html).toContain("Open in shared inbox");
    expect(html).toContain("Ask your first customer question");
    expect(html).toContain("business facts you approved");
    expect(html.toLowerCase()).not.toMatch(/\b(?:clinics?|patients?)\b/);
    expect(html.indexOf("Book a free demo")).toBeLessThan(
      html.indexOf("See paid plans"),
    );
  });
});
