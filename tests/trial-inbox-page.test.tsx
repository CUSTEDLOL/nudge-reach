import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { findProfile, getTrialTestConversation } = vi.hoisted(() => ({
  findProfile: vi.fn(),
  getTrialTestConversation: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: { agentProfile: { findUnique: findProfile } },
}));
vi.mock("@/modules/trial/test-inbox-query", () => ({
  getTrialTestConversation,
}));
vi.mock("@/components/features/trial/try-your-ai", async () => {
  const { createElement } = await import("react");
  return {
    TryYourAi: ({ initialMessages }: { initialMessages: unknown[] }) =>
      createElement(
        "div",
        { "data-testid": "trial-composer" },
        `Private test composer · ${initialMessages.length} messages`,
      ),
  };
});

import { TrialInbox } from "@/components/features/trial/trial-inbox";
import type { TrialWorkspace } from "@/modules/trial/workspace";

const workspace: TrialWorkspace = {
  id: "trial_1",
  status: "active",
  expiresAt: "2026-09-28T10:00:00.000Z",
  repliesUsed: 0,
  replyLimit: 15,
  repliesRemaining: 15,
  setupComplete: false,
  knowledgeSource: null,
  knowledgeReady: false,
  knowledgeCount: 0,
  firstReplyAt: null,
  exploreViewed: false,
  tourStep: "welcome",
  tourCompleted: false,
  tourDismissed: false,
  demoBooked: false,
  converted: false,
};

const org = {
  id: "org_1",
  dialCode: "+91",
  simulated: true,
};

describe("canonical trial Inbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findProfile.mockResolvedValue({ enabled: true });
    getTrialTestConversation.mockResolvedValue({
      conversationId: "conversation_1",
      messages: [
        {
          id: "message_1",
          direction: "inbound",
          body: "Are you open tomorrow?",
          createdAt: "2026-09-22T08:00:00.000Z",
          metaMessageId: null,
        },
      ],
    });
  });

  it("shows a direct Train AI empty state before any facts are approved", async () => {
    const page = await TrialInbox({ org, workspace, upgrade: null });
    const html = renderToStaticMarkup(page);

    expect(html).toContain("<h1");
    expect(html).toContain("Inbox");
    expect(html).toContain('href="/agent"');
    expect(html).toContain("Train AI");
    expect(html).not.toContain("Private test composer");
    expect(findProfile).not.toHaveBeenCalled();
    expect(getTrialTestConversation).not.toHaveBeenCalled();
  });

  it("loads only the private trial conversation and profile when knowledge is ready", async () => {
    const page = await TrialInbox({
      org,
      workspace: { ...workspace, setupComplete: true, knowledgeReady: true },
      upgrade: null,
    });
    const html = renderToStaticMarkup(page);

    expect(findProfile).toHaveBeenCalledWith({
      where: { orgId: "org_1" },
      select: { enabled: true },
    });
    expect(getTrialTestConversation).toHaveBeenCalledWith("org_1");
    expect(html).toContain("Private test composer · 1 messages");
    expect(html).toContain("Connect your real WhatsApp");
    expect(html).toContain("Book a free demo");
    expect(html).toContain('href="/pricing"');
    expect(html).toContain("View plans");
    expect(html).not.toContain("analytics");
    expect(html).not.toContain("Open in shared inbox");
  });

  it("explains a paid-route redirect without adding another destination", async () => {
    const page = await TrialInbox({
      org,
      workspace,
      upgrade: "campaigns",
    });
    const html = renderToStaticMarkup(page);

    expect(html).toContain("available on a paid plan");
    expect(html).toContain(
      "Keep testing here or train Nudge with more business information.",
    );
    expect(html).not.toContain("Explore");
  });
});
