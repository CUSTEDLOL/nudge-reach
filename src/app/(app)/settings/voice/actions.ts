"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOrgContext, requireRole } from "@/modules/orgs/auth";
import { checkVoiceAgent } from "@/modules/billing/limits";
import { recordAudit } from "@/modules/orgs/audit";
import { SIM_TRANSCRIPT } from "@/modules/voice/drivers/simulation";
import { fileCall } from "@/modules/voice/file-call";
import { env } from "@/lib/env";
import { voiceUsage } from "@/modules/voice/usage";
import { parseVoiceNumberForm } from "./validate";

export interface ActionResult {
  ok: boolean;
  message: string;
}

export async function saveVoiceNumberAction(formData: FormData): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
    const gate = await checkVoiceAgent(ctx.org.id);
    if (!gate.allowed) return { ok: false, message: gate.message };
    const data = parseVoiceNumberForm(formData);
    await prisma.voiceNumber.upsert({
      where: { phoneE164: data.phoneE164 },
      create: { orgId: ctx.org.id, ...data },
      update: { ...data, orgId: ctx.org.id },
    });
    recordAudit(ctx, "voice.number_saved", data.label, data.phoneE164);
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Couldn't save the number." };
  }
  revalidatePath("/settings/voice");
  return { ok: true, message: "Voice number saved." };
}

export async function removeVoiceNumberAction(id: string): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
    await prisma.voiceNumber.deleteMany({ where: { id, orgId: ctx.org.id } });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Couldn't remove the number." };
  }
  revalidatePath("/settings/voice");
  return { ok: true, message: "Number removed." };
}

export async function toggleReminderCallsAction(enabled: boolean): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
    if (enabled) {
      const gate = await checkVoiceAgent(ctx.org.id);
      if (!gate.allowed) return { ok: false, message: gate.message };
    }
    await prisma.followUpConfig.upsert({
      where: { orgId: ctx.org.id },
      create: { orgId: ctx.org.id, enabled: true, reminderCalls: enabled },
      update: { reminderCalls: enabled },
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Couldn't update reminder calls." };
  }
  revalidatePath("/settings/voice");
  return { ok: true, message: enabled ? "Reminder calls on." : "Reminder calls off." };
}

/** Test mode: drop a scripted call into the inbox so the owner sees what a call looks like. */
export async function simulateCallAction(): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  const gate = await checkVoiceAgent(ctx.org.id);
  if (!gate.allowed) return { ok: false, message: gate.message };
  const number = await prisma.voiceNumber.findFirst({ where: { orgId: ctx.org.id } });
  await fileCall(
    ctx.org.id,
    {
      providerCallId: `sim_${Date.now()}`,
      agentId: "sim",
      direction: "inbound",
      fromE164: "+919810009999",
      toE164: number?.phoneE164 ?? "+910000000000",
      durationSecs: 18,
      transcript: SIM_TRANSCRIPT,
      summary: "Priya booked tomorrow at 5pm.",
      callSuccessful: true,
      dynamicVariables: { org_id: ctx.org.id, purpose: "inbound" },
    },
    "inbound"
  );
  revalidatePath("/inbox");
  return { ok: true, message: "A sample call landed in your inbox." };
}

export interface BrowserCallResult extends ActionResult {
  /** Short-lived (15 min) ElevenLabs WebSocket URL — never the API key. */
  signedUrl?: string;
}

/**
 * Talk to this workspace's AI front desk from the browser — no phone number,
 * no carrier, no per-minute carrier fee. The conversation still runs through
 * the real agent, so it hears the same knowledge and uses the same tools.
 *
 * A browser conversation carries no dialled number, so ElevenLabs cannot tell
 * us which business it belongs to. VOICE_TEST_ORG_ID names the single
 * workspace such a call is allowed to reach; we refuse rather than guess.
 */
export async function startBrowserCallAction(): Promise<BrowserCallResult> {
  const ctx = await requireOrgContext();
  const gate = await checkVoiceAgent(ctx.org.id);
  if (!gate.allowed) return { ok: false, message: gate.message };

  const usage = await voiceUsage(ctx.org.id, 1);
  if (usage.exhausted) return { ok: false, message: usage.message };

  if (!env.ELEVENLABS_API_KEY || !env.ELEVENLABS_AGENT_ID) {
    return { ok: false, message: "Voice isn't configured yet — add the ElevenLabs keys and run the setup script." };
  }
  if (env.VOICE_TEST_ORG_ID !== ctx.org.id) {
    return {
      ok: false,
      message: "Browser calls are switched on for one workspace at a time. Ask Nudge to point VOICE_TEST_ORG_ID at this one.",
    };
  }

  const res = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(env.ELEVENLABS_AGENT_ID)}`,
    { headers: { "xi-api-key": env.ELEVENLABS_API_KEY } }
  );
  const json = (await res.json().catch(() => ({}))) as { signed_url?: string; detail?: unknown };
  if (!res.ok || !json.signed_url) {
    return { ok: false, message: `ElevenLabs refused the call (HTTP ${res.status}). Check the API key and agent id.` };
  }
  return { ok: true, message: "Connecting…", signedUrl: json.signed_url };
}
