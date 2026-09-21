import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireFounder,
  setOrgPlan,
  updateLead,
  inviteMember,
  resendInvite,
  rotateOwnerSetupLink,
  founderConnectWhatsapp,
  founderDraftFollowUps,
  revalidatePath,
} = vi.hoisted(() => ({
  requireFounder: vi.fn(),
  setOrgPlan: vi.fn(),
  updateLead: vi.fn(),
  inviteMember: vi.fn(),
  resendInvite: vi.fn(),
  rotateOwnerSetupLink: vi.fn(),
  founderConnectWhatsapp: vi.fn(),
  founderDraftFollowUps: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/modules/admin/auth", () => ({ requireFounder }));
vi.mock("@/modules/admin/set-plan", () => ({ setOrgPlan }));
vi.mock("@/modules/admin/leads", () => ({ updateLead }));
vi.mock("@/modules/admin/team", () => ({
  inviteMember,
  resendInvite,
  rotateOwnerSetupLink,
  removeMember: vi.fn(),
  revokeInvite: vi.fn(),
  setMemberRole: vi.fn(),
  transferOwnership: vi.fn(),
}));
vi.mock("@/modules/admin/integrations", () => ({
  founderConnectWhatsapp,
  founderDisconnectCalendar: vi.fn(),
  founderDisconnectCrm: vi.fn(),
  founderDisconnectLlm: vi.fn(),
  founderDisconnectNumber: vi.fn(),
  founderRevokeApiKey: vi.fn(),
  founderSetCustomActionEnabled: vi.fn(),
  founderSetDefaultNumber: vi.fn(),
  founderSetVoiceNumberEnabled: vi.fn(),
  founderSetWebhookEnabled: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath }));
// The concierge module talks to Prisma and the model router; the action's own
// job is the founder gate, the reason, and handing the result to done().
vi.mock("@/modules/admin/concierge", () => ({
  founderDraftFollowUps,
  founderSetAgentEnabled: vi.fn(),
  founderSetFollowUpsEnabled: vi.fn(),
  founderSetupClient: vi.fn(),
}));

import { runFounderAction } from "@/modules/admin/actions";
import {
  connectWhatsappAction,
  draftFollowUpsAction,
  inviteMemberAction,
  resendInviteAction,
  rotateOwnerSetupLinkAction,
  setPlanAction,
} from "@/app/admin/orgs/[id]/actions";
import { updateLeadAction } from "@/app/admin/leads/actions";

beforeEach(() => {
  vi.clearAllMocks();
  requireFounder.mockResolvedValue({ email: "founder@nudge.test" });
  setOrgPlan.mockResolvedValue({ ok: true, from: "free", to: "pro" });
  founderConnectWhatsapp.mockResolvedValue({
    ok: true,
    message: "Clinic WhatsApp connected. Sending mode was not changed.",
  });
  founderDraftFollowUps.mockResolvedValue({ ok: true, message: "Drafted 1 follow-up." });
});

describe("admin route actions", () => {
  it("normalizes unexpected organization action failures", async () => {
    setOrgPlan.mockRejectedValueOnce(
      new Error("postgres password and internal stack")
    );
    const formData = new FormData();
    formData.set("orgId", "org_123");
    formData.set("plan", "pro");
    formData.set("reason", "Owner approved the upgrade");

    await expect(setPlanAction(formData)).resolves.toEqual({
      ok: false,
      message:
        "That change could not be completed. Nothing else was changed. Try again.",
    });
  });

  it("requires a reason before an account-changing action", async () => {
    const formData = new FormData();
    formData.set("orgId", "org_123");
    formData.set("plan", "pro");

    const result = await setPlanAction(formData);

    expect(result.ok).toBe(false);
    expect(result.message).toContain("reason");
    expect(setOrgPlan).not.toHaveBeenCalled();
  });

  it("passes a trimmed reason to the account-changing module", async () => {
    const formData = new FormData();
    formData.set("orgId", "org_123");
    formData.set("plan", "pro");
    formData.set("reason", "  Owner approved the upgrade  ");

    await setPlanAction(formData);

    expect(setOrgPlan).toHaveBeenCalledWith(
      "org_123",
      "pro",
      "founder@nudge.test",
      "Owner approved the upgrade"
    );
  });

  it("routes founder-created and resent invitations through the team module", async () => {
    inviteMember.mockResolvedValueOnce({ ok: true, message: "Invited." });
    resendInvite.mockResolvedValueOnce({ ok: true, message: "Resent." });
    const inviteForm = new FormData();
    inviteForm.set("orgId", "org_123");
    inviteForm.set("email", "new@clinic.test");
    inviteForm.set("role", "ADMIN");
    const resendForm = new FormData();
    resendForm.set("orgId", "org_123");
    resendForm.set("inviteId", "invite_123");

    await expect(inviteMemberAction(inviteForm)).resolves.toEqual({
      ok: true,
      message: "Invited.",
    });
    await expect(resendInviteAction(resendForm)).resolves.toEqual({
      ok: true,
      message: "Resent.",
    });
    expect(inviteMember).toHaveBeenCalledWith(
      "org_123",
      "new@clinic.test",
      "ADMIN",
      "founder@nudge.test"
    );
    expect(resendInvite).toHaveBeenCalledWith(
      "org_123",
      "invite_123",
      "founder@nudge.test"
    );
  });

  it("routes owner setup-link rotation through the founder gate and preserves the link", async () => {
    const setupLink = {
      url: `https://nudgeagent.app/invite/${"b".repeat(43)}`,
      email: "owner@clinic.test",
      expiresAt: "2026-09-22T15:00:00.000Z",
    };
    rotateOwnerSetupLink.mockResolvedValue({
      ok: true,
      message: "New setup link created.",
      setupLink,
    });
    const form = new FormData();
    form.set("orgId", "org_123");
    form.set("inviteId", "invite_owner");

    await expect(rotateOwnerSetupLinkAction(form)).resolves.toEqual({
      ok: true,
      message: "New setup link created.",
      setupLink,
    });
    expect(rotateOwnerSetupLink).toHaveBeenCalledWith(
      "org_123",
      "invite_owner",
      "founder@nudge.test"
    );
  });

  it("routes a trimmed WhatsApp connection through the founder-only service", async () => {
    const formData = new FormData();
    formData.set("orgId", " org_123 ");
    formData.set("displayName", " Clinic WhatsApp ");
    formData.set("wabaId", " 123456789012345 ");
    formData.set("phoneNumberId", " 987654321098765 ");
    formData.set("accessToken", " EAA-founder-secret-token ");
    formData.set("reason", " Assisted onboarding with owner approval ");

    await expect(connectWhatsappAction(formData)).resolves.toEqual({
      ok: true,
      message: "Clinic WhatsApp connected. Sending mode was not changed.",
    });
    expect(founderConnectWhatsapp).toHaveBeenCalledWith(
      "org_123",
      {
        displayName: "Clinic WhatsApp",
        wabaId: "123456789012345",
        phoneNumberId: "987654321098765",
        accessToken: "EAA-founder-secret-token",
      },
      "founder@nudge.test",
      "Assisted onboarding with owner approval"
    );
  });

  it("writes the client's starter set when the founder leaves the sentence empty", async () => {
    const form = new FormData();
    form.set("orgId", "org_123");
    form.set("request", "  ");
    form.set("reason", "Concierge onboarding call");

    await expect(draftFollowUpsAction(form)).resolves.toEqual({
      ok: true,
      message: "Drafted 1 follow-up.",
    });
    expect(founderDraftFollowUps).toHaveBeenCalledWith(
      "org_123",
      "",
      "founder@nudge.test",
      "Concierge onboarding call"
    );
    // done(): the org's admin pages re-read after a write.
    expect(revalidatePath).toHaveBeenCalledWith("/admin/orgs/org_123", "layout");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/orgs");
  });

  it("passes a typed sentence through to the concierge module", async () => {
    const form = new FormData();
    form.set("orgId", "org_123");
    form.set("request", "  Chase anyone who asked about pricing  ");
    form.set("reason", "Concierge onboarding call");

    await draftFollowUpsAction(form);
    expect(founderDraftFollowUps).toHaveBeenCalledWith(
      "org_123",
      "Chase anyone who asked about pricing",
      "founder@nudge.test",
      "Concierge onboarding call"
    );
  });

  it("requires a reason before drafting into a client's workspace", async () => {
    const form = new FormData();
    form.set("orgId", "org_123");
    form.set("request", "chase quiet leads");

    const result = await draftFollowUpsAction(form);
    expect(result.ok).toBe(false);
    expect(result.message).toContain("reason");
    expect(founderDraftFollowUps).not.toHaveBeenCalled();
  });

  it("normalizes unexpected lead action failures", async () => {
    updateLead.mockRejectedValueOnce(
      new Error("postgres password and internal stack")
    );
    const formData = new FormData();
    formData.set("kind", "access");
    formData.set("id", "lead_123");
    formData.set("status", "qualified");

    await expect(updateLeadAction(formData)).resolves.toEqual({
      ok: false,
      message:
        "That change could not be completed. Nothing else was changed. Try again.",
    });
  });
});

describe("runFounderAction", () => {
  it("authorizes before invoking the privileged work", async () => {
    const work = vi.fn().mockResolvedValue({ ok: true, message: "Changed." });

    const result = await runFounderAction(work);

    expect(requireFounder).toHaveBeenCalledTimes(1);
    expect(work).toHaveBeenCalledWith({ email: "founder@nudge.test" });
    expect(result).toEqual({ ok: true, message: "Changed." });
  });

  it("does not swallow founder denial", async () => {
    requireFounder.mockRejectedValueOnce(new Error("NEXT_NOT_FOUND"));

    await expect(
      runFounderAction(async () => ({ ok: true, message: "Changed." }))
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("returns a stable safe error for unexpected action failures", async () => {
    const result = await runFounderAction(async () => {
      throw new Error("postgres password and internal stack");
    });

    expect(result).toEqual({
      ok: false,
      message:
        "That change could not be completed. Nothing else was changed. Try again.",
    });
    expect(result.message).not.toContain("postgres");
  });
});
