import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireOrgContext,
  isRestrictedAcquisitionTrial,
  suggestReply,
  summarizeConversation,
  handleInboundMessage,
  withTrialReplyReservation,
  trialReplySummary,
  trialFindUnique,
  trialUpdateMany,
} = vi.hoisted(() => ({
  requireOrgContext: vi.fn(),
  isRestrictedAcquisitionTrial: vi.fn(),
  suggestReply: vi.fn(),
  summarizeConversation: vi.fn(),
  handleInboundMessage: vi.fn(),
  withTrialReplyReservation: vi.fn(),
  trialReplySummary: vi.fn(),
  trialFindUnique: vi.fn(),
  trialUpdateMany: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    acquisitionTrial: {
      findUnique: trialFindUnique,
      updateMany: trialUpdateMany,
    },
  },
}));
vi.mock("@/modules/orgs/auth", () => ({ requireOrgContext }));
vi.mock("@/modules/trial/capabilities", () => ({ isRestrictedAcquisitionTrial }));
vi.mock("@/modules/ai/suggest-reply", () => ({
  isSuggestTone: () => true,
  suggestReply,
}));
vi.mock("@/modules/ai/summarize", () => ({ summarizeConversation }));
vi.mock("@/modules/agent/inbound", () => ({ handleInboundMessage }));
vi.mock("@/modules/trial/replies", () => ({
  withTrialReplyReservation,
  trialReplySummary,
}));
import {
  buildConversationWhere,
  parseInboxFilter,
} from "@/modules/inbox/filters";
import {
  firstName,
  formatDayLabel,
  formatRelativeTime,
  serviceWindowState,
  toPreview,
} from "@/modules/inbox/format";
import {
  addContactTagAction,
  addNoteAction,
  assignConversationAction,
  removeContactTagAction,
  sendTemplateAction,
  sendTextAction,
  setConversationStatusAction,
  setLeadStageAction,
  suggestReplyAction,
  simulateInboundAction,
  summarizeConversationAction,
} from "@/app/(app)/inbox/actions";
import { trialSandboxAddress } from "@/modules/trial/test-inbox";

const ORG = "org_1";
const ME = "user_me";

describe("parseInboxFilter", () => {
  it("accepts every known filter", () => {
    for (const f of [
      "all",
      "open",
      "handoff",
      "mine",
      "unassigned",
      "resolved",
      "unread",
    ]) {
      expect(parseInboxFilter(f)).toBe(f);
    }
  });
  it("defaults unknown / missing values to open", () => {
    expect(parseInboxFilter(undefined)).toBe("open");
    expect(parseInboxFilter("bogus")).toBe("open");
  });
});

describe("buildConversationWhere (spec §M2 filters)", () => {
  it("always scopes to the org", () => {
    for (const f of [
      "all",
      "open",
      "handoff",
      "mine",
      "unassigned",
      "resolved",
      "unread",
    ] as const) {
      expect(buildConversationWhere(ORG, f, "", ME).orgId).toBe(ORG);
    }
  });

  it("open includes handoff (shows the Needs-human badge under Open)", () => {
    const where = buildConversationWhere(ORG, "open", "", ME);
    expect(where.status).toEqual({ in: ["open", "handoff"] });
  });

  it("handoff isolates conversations waiting for a person", () => {
    const where = buildConversationWhere(ORG, "handoff", "", ME);
    expect(where.status).toBe("handoff");
  });

  it("resolved treats legacy closed rows as resolved", () => {
    const where = buildConversationWhere(ORG, "resolved", "", ME);
    expect(where.status).toEqual({ in: ["resolved", "closed"] });
  });

  it("mine = assigned to the caller, not yet resolved", () => {
    const where = buildConversationWhere(ORG, "mine", "", ME);
    expect(where.assignedToUserId).toBe(ME);
    expect(where.status).toEqual({ notIn: ["resolved", "closed"] });
  });

  it("unassigned = no assignee, not yet resolved", () => {
    const where = buildConversationWhere(ORG, "unassigned", "", ME);
    expect(where.assignedToUserId).toBeNull();
    expect(where.status).toEqual({ notIn: ["resolved", "closed"] });
  });

  it("unread = unreadCount > 0", () => {
    const where = buildConversationWhere(ORG, "unread", "", ME);
    expect(where.unreadCount).toEqual({ gt: 0 });
  });

  it("all adds no status constraint", () => {
    const where = buildConversationWhere(ORG, "all", "", ME);
    expect(where.status).toBeUndefined();
    expect(where.unreadCount).toBeUndefined();
    expect(where.assignedToUserId).toBeUndefined();
  });

  it("search matches contact name, phone and last-message preview", () => {
    const where = buildConversationWhere(ORG, "all", "priya", ME);
    expect(where.OR).toEqual([
      { contact: { name: { contains: "priya", mode: "insensitive" } } },
      { contact: { phoneE164: { contains: "priya" } } },
      { lastMessagePreview: { contains: "priya", mode: "insensitive" } },
    ]);
  });

  it("blank search adds no OR clause", () => {
    expect(buildConversationWhere(ORG, "all", "   ", ME).OR).toBeUndefined();
  });
});

describe("serviceWindowState (24h window, mirrors lib/agent/window)", () => {
  const now = new Date("2026-06-30T12:00:00Z").getTime();

  it("is closed with no inbound ever", () => {
    expect(serviceWindowState(null, now)).toEqual({ open: false, label: null });
  });

  it("is open with a countdown inside 24h", () => {
    const state = serviceWindowState("2026-06-30T10:30:00Z", now);
    expect(state.open).toBe(true);
    expect(state.label).toBe("22h 30m left");
  });

  it("shows minutes only in the final hour", () => {
    const state = serviceWindowState("2026-06-29T12:45:00Z", now);
    expect(state.open).toBe(true);
    expect(state.label).toBe("45m left");
  });

  it("is closed just past 24h", () => {
    const state = serviceWindowState("2026-06-29T11:59:00Z", now);
    expect(state.open).toBe(false);
  });
});

describe("format helpers", () => {
  const now = new Date("2026-06-30T12:00:00Z").getTime();

  it("formatRelativeTime buckets", () => {
    expect(formatRelativeTime(null, now)).toBe("");
    expect(formatRelativeTime("2026-06-30T11:59:40Z", now)).toBe("now");
    expect(formatRelativeTime("2026-06-30T11:45:00Z", now)).toBe("15m");
    expect(formatRelativeTime("2026-06-30T07:00:00Z", now)).toBe("5h");
    expect(formatRelativeTime("2026-06-28T12:00:00Z", now)).toBe("2d");
  });

  it("formatDayLabel says Today/Yesterday", () => {
    const ref = new Date(2026, 5, 30, 12, 0);
    expect(formatDayLabel(new Date(2026, 5, 30, 1, 0).toISOString(), ref)).toBe("Today");
    expect(formatDayLabel(new Date(2026, 5, 29, 23, 0).toISOString(), ref)).toBe("Yesterday");
  });

  it("firstName takes the first token", () => {
    expect(firstName("Priya Sharma")).toBe("Priya");
    expect(firstName("  Arjun  ")).toBe("Arjun");
  });

  it("toPreview flattens whitespace and truncates at 120 chars", () => {
    expect(toPreview("hello\nworld")).toBe("hello world");
    const long = "x".repeat(200);
    const preview = toPreview(long);
    expect(preview.length).toBe(120);
    expect(preview.endsWith("…")).toBe(true);
  });

  it("toPreview never splits an emoji or emits a lone surrogate (Postgres rejects them)", () => {
    // 119 chars then an emoji: naive .slice(0,119) would cut the pair in half.
    const tricky = "x".repeat(119) + "🙏🙏🙏";
    const preview = toPreview(tricky);
    expect(preview).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
    expect(preview.endsWith("…")).toBe(true);
    // A reply already ending in half an emoji (maxTokens truncation) is cleaned.
    expect(toPreview("thanks \uD83D")).toBe("thanks");
  });
});

describe("restricted acquisition-trial inbox actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireOrgContext.mockResolvedValue({ org: { id: ORG } });
    isRestrictedAcquisitionTrial.mockResolvedValue(true);
  });

  it("blocks AI draft suggestions before reaching the model", async () => {
    const formData = new FormData();
    formData.set("conversationId", "conversation_1");
    formData.set("tone", "friendly");

    await expect(suggestReplyAction(formData)).resolves.toEqual({
      ok: false,
      message: "This AI tool is available on paid plans.",
    });
    expect(suggestReply).not.toHaveBeenCalled();
  });

  it("blocks conversation summaries before reaching the model", async () => {
    const formData = new FormData();
    formData.set("conversationId", "conversation_1");

    await expect(summarizeConversationAction(formData)).resolves.toEqual({
      ok: false,
      message: "This AI tool is available on paid plans.",
    });
    expect(summarizeConversation).not.toHaveBeenCalled();
  });

  it.each([
    ["send text", sendTextAction],
    ["send template", sendTemplateAction],
    ["change status", setConversationStatusAction],
    ["assign", assignConversationAction],
    ["change lead stage", setLeadStageAction],
    ["add tag", addContactTagAction],
    ["remove tag", removeContactTagAction],
    ["add note", addNoteAction],
  ])("blocks the hidden paid mutation: %s", async (_label, action) => {
    await expect(action(new FormData())).resolves.toEqual({
      ok: false,
      message: "This action is available on paid plans.",
    });
  });
});

describe("trial-metered simulated inbound action", () => {
  const summary = {
    status: "active",
    repliesUsed: 4,
    replyLimit: 15,
    repliesRemaining: 11,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    requireOrgContext.mockResolvedValue({
      org: { id: ORG, simulated: true, dialCode: "+91" },
    });
    withTrialReplyReservation.mockImplementation(
      async (_orgId: string, work: () => Promise<unknown>) => ({
        kind: "handled",
        result: await work(),
      })
    );
    trialFindUnique.mockResolvedValue({ id: "trial_1" });
    trialUpdateMany.mockResolvedValue({ count: 1 });
    trialReplySummary.mockResolvedValue(summary);
    isRestrictedAcquisitionTrial.mockResolvedValue(true);
  });

  function formData() {
    const value = new FormData();
    value.set("phone", "9876500001");
    value.set("text", "Are you open tomorrow?");
    return value;
  }

  it("returns a safe error when the metered inbound boundary throws", async () => {
    withTrialReplyReservation.mockRejectedValue(new Error("provider down"));

    await expect(simulateInboundAction(formData())).resolves.toEqual({
      ok: false,
      message: "The simulated message failed — try again.",
    });
  });

  it("ignores a forged phone and always uses the org's +999 sandbox identity", async () => {
    await simulateInboundAction(formData());

    expect(handleInboundMessage).toHaveBeenCalledWith(
      ORG,
      trialSandboxAddress(ORG),
      "Are you open tomorrow?",
    );
  });

  it.each([
    ["STOP", { optedOut: true }],
    ["no profile", { conversationId: "conversation_1", skipped: "no_profile" }],
    ["no reply", { conversationId: "conversation_1" }],
  ])("renders the handled %s result", async (_case, result) => {
    withTrialReplyReservation.mockResolvedValue({ kind: "handled", result });

    await simulateInboundAction(formData());
    expect(trialUpdateMany).not.toHaveBeenCalled();
  });

  it("keeps the slot for an AI reply and returns the authoritative remainder", async () => {
    withTrialReplyReservation.mockResolvedValue({
      kind: "handled",
      result: {
        conversationId: "conversation_1",
        reply: "Yes, we are open.",
        generatedByAi: true,
      },
      trial: summary,
    });

    await expect(simulateInboundAction(formData())).resolves.toMatchObject({
      ok: true,
      conversationId: "conversation_1",
      trial: summary,
    });
  });

  it("records the first successful reply and returns a fresh trial summary", async () => {
    const freshSummary = {
      ...summary,
      repliesUsed: 5,
      repliesRemaining: 10,
    };
    withTrialReplyReservation.mockResolvedValue({
      kind: "handled",
      result: {
        conversationId: "conversation_1",
        reply: "Yes, we are open.",
        generatedByAi: true,
      },
      trial: summary,
    });
    trialReplySummary.mockResolvedValue(freshSummary);

    await expect(simulateInboundAction(formData())).resolves.toMatchObject({
      ok: true,
      conversationId: "conversation_1",
      trial: freshSummary,
    });
    expect(trialUpdateMany).toHaveBeenCalledWith({
      where: { id: "trial_1", firstReplyAt: null },
      data: { firstReplyAt: expect.any(Date) },
    });
  });

  it("keeps the successful reply when milestone stamping fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    withTrialReplyReservation.mockResolvedValue({
      kind: "handled",
      result: {
        conversationId: "conversation_1",
        reply: "Yes, we are open.",
        generatedByAi: true,
      },
      trial: summary,
    });
    trialUpdateMany.mockRejectedValue(new Error("database unavailable"));

    await expect(simulateInboundAction(formData())).resolves.toMatchObject({
      ok: true,
      conversationId: "conversation_1",
      trial: summary,
    });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("blocks before the inbound path when the trial is exhausted", async () => {
    withTrialReplyReservation.mockResolvedValue({
      kind: "blocked",
      status: "exhausted",
      trial: {
        ...summary,
        status: "exhausted",
        repliesUsed: 15,
        repliesRemaining: 0,
      },
    });

    await expect(simulateInboundAction(formData())).resolves.toMatchObject({
      ok: false,
      skipped: "trial_limit",
      trial: { status: "exhausted", repliesRemaining: 0 },
    });
    expect(handleInboundMessage).not.toHaveBeenCalled();
  });
});
