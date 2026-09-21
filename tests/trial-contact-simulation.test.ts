import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  prisma,
  requireOrg,
  isRestrictedAcquisitionTrial,
  handleInboundMessage,
  withTrialReplyReservation,
} = vi.hoisted(() => ({
  prisma: {
    contact: { findFirst: vi.fn() },
  },
  requireOrg: vi.fn(),
  isRestrictedAcquisitionTrial: vi.fn(),
  handleInboundMessage: vi.fn(),
  withTrialReplyReservation: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/modules/orgs/auth", () => ({
  requireOrg,
  requireOrgContext: vi.fn(),
  requireRole: vi.fn(),
}));
vi.mock("@/modules/orgs/mode", () => ({ isSimulated: () => true }));
vi.mock("@/modules/agent/inbound", () => ({ handleInboundMessage }));
vi.mock("@/modules/trial/capabilities", () => ({ isRestrictedAcquisitionTrial }));
vi.mock("@/modules/trial/replies", () => ({ withTrialReplyReservation }));
vi.mock("@/modules/contacts/events", () => ({ recordContactEvent: vi.fn() }));
vi.mock("@/modules/automation/triggers", () => ({
  fireContactCreated: vi.fn(),
  fireTagAdded: vi.fn(),
}));

import { simulateContactMessage } from "@/app/(app)/contacts/actions";

describe("contact simulation trial boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireOrg.mockResolvedValue({ id: "org_1", simulated: true });
    isRestrictedAcquisitionTrial.mockResolvedValue(true);
    prisma.contact.findFirst.mockResolvedValue({
      id: "contact_1",
      phoneE164: "+919876500001",
    });
    handleInboundMessage.mockResolvedValue({
      conversationId: "conversation_1",
      reply: "Unmetered reply",
      generatedByAi: true,
    });
    withTrialReplyReservation.mockResolvedValue({
      kind: "blocked",
      status: "exhausted",
      trial: {
        status: "exhausted",
        repliesUsed: 15,
        replyLimit: 15,
        repliesRemaining: 0,
      },
    });
  });

  it("blocks the hidden contact tester before the inbound handler", async () => {
    const formData = new FormData();
    formData.set("contactId", "contact_1");
    formData.set("text", "Are you open tomorrow?");

    await expect(simulateContactMessage(formData)).resolves.toEqual({
      ok: false,
      message: "Use the private Test Inbox during your free trial.",
    });
    expect(withTrialReplyReservation).not.toHaveBeenCalled();
    expect(handleInboundMessage).not.toHaveBeenCalled();
  });
});
