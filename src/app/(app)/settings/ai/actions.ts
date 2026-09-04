"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext, requireRole } from "@/modules/orgs/auth";
import { checkByoLlm } from "@/modules/billing/limits";
import { recordAudit } from "@/modules/orgs/audit";
import {
  saveLlmAccount,
  deleteLlmAccount,
} from "@/modules/ai/llm-account";
import { getByokRuntime } from "@/lib/model-router/byok";

export interface ActionResult {
  ok: boolean;
  message: string;
}

async function gate() {
  const ctx = await requireOrgContext();
  requireRole(ctx, "ADMIN");
  const plan = await checkByoLlm(ctx.org.id);
  if (!plan.allowed) throw new Error(plan.message);
  return ctx;
}

export async function saveLlmAccountAction(formData: FormData): Promise<ActionResult> {
  try {
    const ctx = await gate();
    const res = await saveLlmAccount(ctx.org.id, {
      provider: String(formData.get("provider") ?? ""),
      model: String(formData.get("model") ?? ""),
      apiKey: String(formData.get("apiKey") ?? "").trim() || undefined,
    });
    if (res.ok) {
      recordAudit(ctx, "llm.connected", `${formData.get("provider")}/${formData.get("model")}`);
      revalidatePath("/settings/ai");
    }
    return res;
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Couldn't save." };
  }
}

export async function disconnectLlmAccountAction(): Promise<ActionResult> {
  try {
    const ctx = await gate();
    await deleteLlmAccount(ctx.org.id);
    recordAudit(ctx, "llm.disconnected");
    revalidatePath("/settings/ai");
    return { ok: true, message: "Back on Nudge's built-in AI model." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Couldn't disconnect." };
  }
}

/** Live "does this key work?" ping on the org's configured provider. */
export async function testLlmAccountAction(): Promise<ActionResult> {
  try {
    const ctx = await gate();
    const byok = await getByokRuntime(ctx.org.id);
    if (!byok) {
      return {
        ok: false,
        message: "No usable BYO model configured — save a provider, model and key first.",
      };
    }
    const { text } = await byok.driver.chat(byok.rt, {
      system: "Reply with exactly: OK",
      messages: [{ role: "user", text: "ping" }],
      maxTokens: 10,
    });
    return text.toUpperCase().includes("OK")
      ? { ok: true, message: `${byok.provider} responded — your key works.` }
      : { ok: true, message: `${byok.provider} responded (“${text.slice(0, 40)}”) — key works.` };
  } catch (err) {
    return {
      ok: false,
      message: `The provider rejected the call${err instanceof Error ? `: ${err.message.slice(0, 120)}` : ""}.`,
    };
  }
}
