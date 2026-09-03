"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOrgContext, requireRole } from "@/modules/orgs/auth";
import { recordAudit } from "@/modules/orgs/audit";
import { SIM_TRANSCRIPT } from "@/modules/voice/drivers/simulation";
import { fileCall } from "@/modules/voice/file-call";
import { parseVoiceNumberForm } from "./validate";

export interface ActionResult {
  ok: boolean;
  message: string;
}

export async function saveVoiceNumberAction(formData: FormData): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
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
