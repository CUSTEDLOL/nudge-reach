import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireFounder,
  setOrgPlan,
  updateLead,
  inviteMember,
  resendInvite,
  founderConnectWhatsapp,
} = vi.hoisted(() => ({
  requireFounder: vi.fn(),
  setOrgPlan: vi.fn(),
  updateLead: vi.fn(),
  inviteMember: vi.fn(),
  resendInvite: vi.fn(),
  founderConnectWhatsapp: vi.fn(),
}));

vi.mock("@/modules/admin/auth", () => ({ requireFounder }));
vi.mock("@/modules/admin/set-plan", () => ({ setOrgPlan }));
vi.mock("@/modules/admin/leads", () => ({ updateLead }));
vi.mock("@/modules/admin/team", () => ({
  inviteMember,
  resendInvite,
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
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { runFounderAction } from "@/modules/admin/actions";
import {
  connectWhatsappAction,
  inviteMemberAction,
  resendInviteAction,
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
