"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";
import { requireOrgContext, requireRole } from "@/modules/orgs/auth";
import { checkCustomActions } from "@/modules/billing/limits";
import { recordAudit } from "@/modules/orgs/audit";
import {
  isValidActionName,
  runCustomActionOnce,
} from "@/modules/agent/tools/custom";

export interface ActionResult {
  ok: boolean;
  message: string;
}

const MAX_ACTIONS_PER_ORG = 10;

/** Shared validation for create/update. Returns an error message or the clean data. */
function parseForm(formData: FormData):
  | { ok: false; message: string }
  | {
      ok: true;
      data: {
        name: string;
        description: string;
        url: string;
        method: string;
        timeoutMs: number;
        inputSchema: object;
        secret: string;
      };
    } {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const method = String(formData.get("method") ?? "POST");
  const timeoutMs = Number(formData.get("timeoutMs") ?? 8000);
  const schemaRaw = String(formData.get("inputSchema") ?? "").trim();
  const secret = String(formData.get("secret") ?? "").trim();

  if (!isValidActionName(name)) {
    return {
      ok: false,
      message:
        "Name must be a lowercase slug like check_order_status (3–40 chars) and can't shadow a built-in tool.",
    };
  }
  if (description.length < 20 || description.length > 300) {
    return {
      ok: false,
      message:
        "Describe what the action does and when to use it (20–300 characters) — the AI reads this.",
    };
  }
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return { ok: false, message: "Enter a valid URL (https://…)." };
  }
  if (parsedUrl.protocol !== "https:") {
    return { ok: false, message: "Action URLs must use https://." };
  }
  if (method !== "GET" && method !== "POST") {
    return { ok: false, message: "Method must be GET or POST." };
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1000 || timeoutMs > 15000) {
    return { ok: false, message: "Timeout must be between 1000 and 15000 ms." };
  }
  let inputSchema: object = { type: "object", properties: {} };
  if (schemaRaw) {
    try {
      const parsed = JSON.parse(schemaRaw) as { type?: string };
      if (typeof parsed !== "object" || parsed === null || parsed.type !== "object") {
        return { ok: false, message: 'The input schema must be a JSON object with "type": "object".' };
      }
      inputSchema = parsed;
    } catch {
      return { ok: false, message: "The input schema isn't valid JSON." };
    }
  }
  return { ok: true, data: { name, description, url, method, timeoutMs, inputSchema, secret } };
}

async function gate() {
  const ctx = await requireOrgContext();
  requireRole(ctx, "ADMIN");
  const plan = await checkCustomActions(ctx.org.id);
  if (!plan.allowed) throw new Error(plan.message);
  return ctx;
}

export async function createCustomActionAction(formData: FormData): Promise<ActionResult> {
  try {
    const ctx = await gate();
    const parsed = parseForm(formData);
    if (!parsed.ok) return parsed;

    const count = await prisma.customAction.count({ where: { orgId: ctx.org.id } });
    if (count >= MAX_ACTIONS_PER_ORG) {
      return { ok: false, message: `Up to ${MAX_ACTIONS_PER_ORG} actions per workspace for now.` };
    }

    const { secret, ...data } = parsed.data;
    await prisma.customAction.create({
      data: {
        orgId: ctx.org.id,
        ...data,
        secretEncrypted: secret ? encryptSecret(secret) : null,
      },
    });
    recordAudit(ctx, "custom_action.created", parsed.data.name);
    revalidatePath("/settings/custom-actions");
    return { ok: true, message: `Action “${parsed.data.name}” added — your agent can use it now.` };
  } catch (err) {
    if (err instanceof Error && err.message.includes("Unique constraint")) {
      return { ok: false, message: "You already have an action with that name." };
    }
    return { ok: false, message: err instanceof Error ? err.message : "Couldn't add the action." };
  }
}

export async function updateCustomActionAction(formData: FormData): Promise<ActionResult> {
  try {
    const ctx = await gate();
    const id = String(formData.get("id") ?? "");
    const parsed = parseForm(formData);
    if (!parsed.ok) return parsed;

    const { secret, ...data } = parsed.data;
    const updated = await prisma.customAction.updateMany({
      where: { id, orgId: ctx.org.id },
      data: {
        ...data,
        // Leaving the secret blank keeps the stored one.
        ...(secret ? { secretEncrypted: encryptSecret(secret) } : {}),
      },
    });
    if (updated.count === 0) return { ok: false, message: "Action not found." };
    recordAudit(ctx, "custom_action.updated", parsed.data.name);
    revalidatePath("/settings/custom-actions");
    return { ok: true, message: "Action updated." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Couldn't update the action." };
  }
}

export async function toggleCustomActionAction(formData: FormData): Promise<ActionResult> {
  try {
    const ctx = await gate();
    const id = String(formData.get("id") ?? "");
    const enabled = formData.get("enabled") === "true";
    const updated = await prisma.customAction.updateMany({
      where: { id, orgId: ctx.org.id },
      data: { enabled },
    });
    if (updated.count === 0) return { ok: false, message: "Action not found." };
    revalidatePath("/settings/custom-actions");
    return { ok: true, message: enabled ? "Action enabled." : "Action paused." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Couldn't update the action." };
  }
}

export async function deleteCustomActionAction(formData: FormData): Promise<ActionResult> {
  try {
    const ctx = await gate();
    const id = String(formData.get("id") ?? "");
    const row = await prisma.customAction.findFirst({
      where: { id, orgId: ctx.org.id },
      select: { name: true },
    });
    await prisma.customAction.deleteMany({ where: { id, orgId: ctx.org.id } });
    if (row) recordAudit(ctx, "custom_action.deleted", row.name);
    revalidatePath("/settings/custom-actions");
    return { ok: true, message: "Action removed." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Couldn't remove the action." };
  }
}

export interface TestActionResult extends ActionResult {
  output?: string;
}

/** Run the action once with sample JSON input (simulation-aware). */
export async function testCustomActionAction(formData: FormData): Promise<TestActionResult> {
  try {
    const ctx = await gate();
    const id = String(formData.get("id") ?? "");
    let sample: Record<string, unknown> = {};
    const raw = String(formData.get("sample") ?? "").trim();
    if (raw) {
      try {
        sample = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        return { ok: false, message: "Sample input isn't valid JSON." };
      }
    }
    const r = await runCustomActionOnce(ctx.org.id, id, sample);
    return {
      ok: !r.isError,
      message: r.isError ? "The action returned an error." : "Action ran.",
      output: r.result,
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Couldn't test the action." };
  }
}
