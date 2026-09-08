"use server";

import { revalidatePath } from "next/cache";
import { runFounderAction, type AdminActionResult } from "@/modules/admin/actions";
import { setOrgPlan } from "@/modules/admin/set-plan";
import {
  parseOverridesForm,
  setFeatureOverrides,
  setFounderNotes,
  setLiveMode,
  setSubscriptionStatus,
  setSuspended,
  setTrial,
  setVoiceMinutes,
} from "@/modules/admin/org-controls";
import type { FounderResult } from "@/modules/admin/audit";

function done(orgId: string, res: FounderResult): AdminActionResult {
  if (!res.ok) return { ok: false, message: res.error };
  revalidatePath(`/admin/orgs/${orgId}`, "layout");
  revalidatePath("/admin/orgs");
  return { ok: true, message: res.message };
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

/** Founder-only: change an org's plan (audited in modules/admin/set-plan). */
export async function setPlanAction(formData: FormData): Promise<AdminActionResult> {
  return runFounderAction(async (founder) => {
    const orgId = str(formData, "orgId");
    const res = await setOrgPlan(orgId, str(formData, "plan"), founder.email);
    if (!res.ok) return { ok: false, message: res.error };
    revalidatePath(`/admin/orgs/${orgId}`, "layout");
    revalidatePath("/admin/orgs");
    return { ok: true, message: `Plan changed: ${res.from} → ${res.to}.` };
  });
}

export async function setTrialAction(formData: FormData): Promise<AdminActionResult> {
  return runFounderAction(async (founder) => {
    const orgId = str(formData, "orgId");
    const days = Number(str(formData, "days"));
    return done(orgId, await setTrial(orgId, days, founder.email, str(formData, "reason")));
  });
}

export async function setSubscriptionStatusAction(formData: FormData): Promise<AdminActionResult> {
  return runFounderAction(async (founder) => {
    const orgId = str(formData, "orgId");
    return done(
      orgId,
      await setSubscriptionStatus(orgId, str(formData, "status"), founder.email, str(formData, "reason"))
    );
  });
}

export async function setLiveModeAction(formData: FormData): Promise<AdminActionResult> {
  return runFounderAction(async (founder) => {
    const orgId = str(formData, "orgId");
    const live = str(formData, "live") === "true";
    return done(orgId, await setLiveMode(orgId, live, founder.email, str(formData, "reason")));
  });
}

export async function setVoiceMinutesAction(formData: FormData): Promise<AdminActionResult> {
  return runFounderAction(async (founder) => {
    const orgId = str(formData, "orgId");
    const raw = str(formData, "minutes");
    const minutes = raw === "" ? null : Number(raw);
    return done(orgId, await setVoiceMinutes(orgId, minutes, founder.email, str(formData, "reason")));
  });
}

export async function setSuspendedAction(formData: FormData): Promise<AdminActionResult> {
  return runFounderAction(async (founder) => {
    const orgId = str(formData, "orgId");
    const suspended = str(formData, "suspended") === "true";
    return done(orgId, await setSuspended(orgId, suspended, founder.email, str(formData, "reason")));
  });
}

export async function setFeatureOverridesAction(formData: FormData): Promise<AdminActionResult> {
  return runFounderAction(async (founder) => {
    const orgId = str(formData, "orgId");
    const form: Record<string, string> = {};
    for (const [k, v] of formData.entries()) {
      if (k.startsWith("ov.") && typeof v === "string") form[k.slice(3)] = v;
    }
    return done(
      orgId,
      await setFeatureOverrides(orgId, parseOverridesForm(form), founder.email, str(formData, "reason"))
    );
  });
}

export async function setFounderNotesAction(formData: FormData): Promise<AdminActionResult> {
  return runFounderAction(async () => {
    const orgId = str(formData, "orgId");
    const res = await setFounderNotes(orgId, String(formData.get("notes") ?? ""));
    if (!res.ok) return { ok: false, message: res.error };
    revalidatePath(`/admin/orgs/${orgId}`);
    return { ok: true, message: res.message };
  });
}

// ---- Team -----------------------------------------------------------------
import { removeMember, revokeInvite, setMemberRole, transferOwnership } from "@/modules/admin/team";

export async function setMemberRoleAction(formData: FormData): Promise<AdminActionResult> {
  return runFounderAction(async (founder) => {
    const orgId = str(formData, "orgId");
    return done(
      orgId,
      await setMemberRole(orgId, str(formData, "membershipId"), str(formData, "role"), founder.email, str(formData, "reason"))
    );
  });
}

export async function removeMemberAction(formData: FormData): Promise<AdminActionResult> {
  return runFounderAction(async (founder) => {
    const orgId = str(formData, "orgId");
    return done(orgId, await removeMember(orgId, str(formData, "membershipId"), founder.email, str(formData, "reason")));
  });
}

export async function transferOwnershipAction(formData: FormData): Promise<AdminActionResult> {
  return runFounderAction(async (founder) => {
    const orgId = str(formData, "orgId");
    return done(
      orgId,
      await transferOwnership(orgId, str(formData, "membershipId"), founder.email, str(formData, "reason"))
    );
  });
}

export async function revokeInviteAction(formData: FormData): Promise<AdminActionResult> {
  return runFounderAction(async (founder) => {
    const orgId = str(formData, "orgId");
    return done(orgId, await revokeInvite(orgId, str(formData, "inviteId"), founder.email));
  });
}

// ---- Integrations ---------------------------------------------------------
import {
  founderDisconnectCalendar,
  founderDisconnectCrm,
  founderDisconnectLlm,
  founderDisconnectNumber,
  founderRevokeApiKey,
  founderSetCustomActionEnabled,
  founderSetDefaultNumber,
  founderSetVoiceNumberEnabled,
  founderSetWebhookEnabled,
} from "@/modules/admin/integrations";

export async function disconnectNumberAction(formData: FormData): Promise<AdminActionResult> {
  return runFounderAction(async (founder) => {
    const orgId = str(formData, "orgId");
    return done(orgId, await founderDisconnectNumber(orgId, str(formData, "accountId"), founder.email, str(formData, "reason")));
  });
}

export async function setDefaultNumberAction(formData: FormData): Promise<AdminActionResult> {
  return runFounderAction(async (founder) => {
    const orgId = str(formData, "orgId");
    return done(orgId, await founderSetDefaultNumber(orgId, str(formData, "accountId"), founder.email));
  });
}

export async function disconnectCalendarAction(formData: FormData): Promise<AdminActionResult> {
  return runFounderAction(async (founder) => {
    const orgId = str(formData, "orgId");
    return done(orgId, await founderDisconnectCalendar(orgId, founder.email, str(formData, "reason")));
  });
}

export async function disconnectLlmAction(formData: FormData): Promise<AdminActionResult> {
  return runFounderAction(async (founder) => {
    const orgId = str(formData, "orgId");
    return done(orgId, await founderDisconnectLlm(orgId, founder.email, str(formData, "reason")));
  });
}

export async function setVoiceNumberEnabledAction(formData: FormData): Promise<AdminActionResult> {
  return runFounderAction(async (founder) => {
    const orgId = str(formData, "orgId");
    return done(
      orgId,
      await founderSetVoiceNumberEnabled(orgId, str(formData, "voiceNumberId"), str(formData, "enabled") === "true", founder.email, str(formData, "reason"))
    );
  });
}

export async function disconnectCrmAction(formData: FormData): Promise<AdminActionResult> {
  return runFounderAction(async (founder) => {
    const orgId = str(formData, "orgId");
    return done(orgId, await founderDisconnectCrm(orgId, str(formData, "provider"), founder.email, str(formData, "reason")));
  });
}

export async function revokeApiKeyAction(formData: FormData): Promise<AdminActionResult> {
  return runFounderAction(async (founder) => {
    const orgId = str(formData, "orgId");
    return done(orgId, await founderRevokeApiKey(orgId, str(formData, "keyId"), founder.email, str(formData, "reason")));
  });
}

export async function setWebhookEnabledAction(formData: FormData): Promise<AdminActionResult> {
  return runFounderAction(async (founder) => {
    const orgId = str(formData, "orgId");
    return done(
      orgId,
      await founderSetWebhookEnabled(orgId, str(formData, "endpointId"), str(formData, "enabled") === "true", founder.email, str(formData, "reason"))
    );
  });
}

export async function setCustomActionEnabledAction(formData: FormData): Promise<AdminActionResult> {
  return runFounderAction(async (founder) => {
    const orgId = str(formData, "orgId");
    return done(
      orgId,
      await founderSetCustomActionEnabled(orgId, str(formData, "actionId"), str(formData, "enabled") === "true", founder.email, str(formData, "reason"))
    );
  });
}

// ---- Front Desk (concierge) ----------------------------------------------
import { founderSetAgentEnabled, founderSetFollowUpsEnabled, founderSetupClient } from "@/modules/admin/concierge";

export async function setupClientAction(formData: FormData): Promise<AdminActionResult> {
  return runFounderAction(async (founder) => {
    const orgId = str(formData, "orgId");
    const res = await founderSetupClient(
      orgId,
      {
        businessName: str(formData, "businessName"),
        vertical: str(formData, "vertical"),
        tone: str(formData, "tone"),
        doNots: str(formData, "doNots"),
        hours: str(formData, "hours"),
        location: str(formData, "location"),
        services: str(formData, "services"),
        prices: str(formData, "prices"),
        policies: str(formData, "policies"),
        faqs: str(formData, "faqs"),
      },
      founder.email
    );
    return done(orgId, res);
  });
}

export async function setAgentEnabledAction(formData: FormData): Promise<AdminActionResult> {
  return runFounderAction(async (founder) => {
    const orgId = str(formData, "orgId");
    return done(orgId, await founderSetAgentEnabled(orgId, str(formData, "enabled") === "true", founder.email, str(formData, "reason")));
  });
}

export async function setFollowUpsEnabledAction(formData: FormData): Promise<AdminActionResult> {
  return runFounderAction(async (founder) => {
    const orgId = str(formData, "orgId");
    return done(orgId, await founderSetFollowUpsEnabled(orgId, str(formData, "enabled") === "true", founder.email, str(formData, "reason")));
  });
}
