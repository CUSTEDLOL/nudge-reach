import type { CustomAction } from "@prisma/client";
import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { getPlan } from "@/modules/billing/plans";
import { sendModeFor } from "@/modules/orgs/mode";
import {
  assertPublicHttpsUrl,
  signWebhook,
} from "@/modules/integrations/outbound-webhooks";
import type { AgentTool, ToolContext } from "@/modules/agent/tools/types";
import { BUILTIN_TOOL_NAMES } from "@/modules/agent/tools";

/**
 * E2 (docs/plans/2026-09-04-enterprise-track.md): per-org HTTP actions the
 * agent can call mid-conversation. Safety contract: org-authored JSON schema
 * validates the model's args; the outbound-webhook SSRF guards are reused
 * verbatim; responses are truncated; simulated orgs never touch the network
 * (invariant 4); every failure is a model-recoverable isError string.
 */

/** Max bytes of a customer-endpoint response fed back to the model. */
export const RESPONSE_CAP = 4096;

const NAME_PATTERN = /^[a-z][a-z0-9_]{2,40}$/;

export function isValidActionName(name: string): boolean {
  return NAME_PATTERN.test(name) && !BUILTIN_TOOL_NAMES.has(name);
}

interface JsonSchemaLite {
  type?: string;
  properties?: Record<string, { type?: string; description?: string }>;
  required?: string[];
}

/**
 * Light structural validation (types + required) — deliberately not a full
 * JSON Schema engine; org-authored schemas are simple flat forms.
 * Returns a model-readable error string, or null when the input is fine.
 */
export function validateCustomInput(schema: unknown, input: unknown): string | null {
  const s = (schema ?? {}) as JsonSchemaLite;
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return "Input must be an object with the documented fields.";
  }
  const obj = input as Record<string, unknown>;
  const missing = (s.required ?? []).filter((k) => obj[k] === undefined || obj[k] === "");
  if (missing.length > 0) {
    return `Missing required field${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`;
  }
  for (const [key, value] of Object.entries(obj)) {
    const expected = s.properties?.[key]?.type;
    if (!expected) continue;
    const actual = Array.isArray(value) ? "array" : typeof value;
    const wanted = expected === "integer" ? "number" : expected;
    if (actual !== wanted) {
      return `Field ${key} must be a ${expected}.`;
    }
  }
  return null;
}

/** Sanitized JSON-ish echo used for simulated orgs and the test-run button. */
function simulatedResult(action: Pick<CustomAction, "name">, input: unknown): string {
  return JSON.stringify({
    simulated: true,
    action: action.name,
    input,
    note: "Test mode — no request was made. Live mode calls your endpoint.",
  });
}

async function executeLive(action: CustomAction, input: unknown): Promise<string> {
  await assertPublicHttpsUrl(action.url);

  const isGet = action.method === "GET";
  const url = new URL(action.url);
  if (isGet) {
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      url.searchParams.set(k, String(v));
    }
  }
  const body = isGet ? undefined : JSON.stringify({ input });
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (action.secretEncrypted) {
    const secret = decryptSecret(action.secretEncrypted);
    headers.authorization = `Bearer ${secret}`;
    if (body) headers["x-nudge-signature"] = signWebhook(body, secret);
  }

  const response = await fetch(url, {
    method: action.method,
    headers,
    body,
    redirect: "error", // same posture as webhook deliveries
    signal: AbortSignal.timeout(Math.min(action.timeoutMs, 15_000)),
  });
  const text = (await response.text()).slice(0, RESPONSE_CAP);
  if (!response.ok) {
    throw new Error(`endpoint returned HTTP ${response.status}`);
  }
  return text || "(the endpoint returned an empty response)";
}

function toAgentTool(action: CustomAction, simulated: boolean): AgentTool {
  return {
    def: {
      name: action.name,
      description: action.description,
      input_schema: (action.inputSchema ?? { type: "object", properties: {} }) as AgentTool["def"]["input_schema"],
    },
    write: true,
    async parseAndRun(_ctx: ToolContext, rawInput: unknown) {
      const invalid = validateCustomInput(action.inputSchema, rawInput ?? {});
      if (invalid) {
        return {
          result: `Invalid input for ${action.name}: ${invalid} Ask the customer for the missing details, then try again.`,
          isError: true,
        };
      }
      if (simulated) {
        return { result: simulatedResult(action, rawInput) };
      }
      try {
        return { result: await executeLive(action, rawInput) };
      } catch {
        return {
          result: `The ${action.name} action could not be completed right now. Answer from what you know, or let the customer know a team member will follow up.`,
          isError: true,
        };
      }
    },
  };
}

/**
 * The org's enabled custom actions as agent tools. Empty unless the org's
 * plan carries the customActions flag. Never throws — a broken load must not
 * take down the reply path.
 */
export async function loadCustomTools(orgId: string): Promise<AgentTool[]> {
  try {
    const org = await prisma.org.findUnique({
      where: { id: orgId },
      select: { id: true, plan: true, simulated: true },
    });
    if (!org || !getPlan(org.plan).limits.customActions) return [];

    const rows = await prisma.customAction.findMany({
      where: { orgId, enabled: true },
      orderBy: { createdAt: "asc" },
    });
    const simulated = sendModeFor(org) === "simulation";
    return rows
      .filter((r) => isValidActionName(r.name))
      .map((r) => toAgentTool(r, simulated));
  } catch (err) {
    console.error("[custom-actions] load failed", err);
    return [];
  }
}

/** One-off run for the settings "Test action" button (respects simulation). */
export async function runCustomActionOnce(
  orgId: string,
  actionId: string,
  sampleInput: Record<string, unknown>
): Promise<{ result: string; isError?: boolean }> {
  const action = await prisma.customAction.findFirst({
    where: { id: actionId, orgId },
  });
  if (!action) return { result: "Action not found.", isError: true };
  const org = await prisma.org.findUnique({
    where: { id: orgId },
    select: { id: true, simulated: true },
  });
  const simulated = !org || sendModeFor(org) === "simulation";
  const tool = toAgentTool(action, simulated);
  return tool.parseAndRun(
    { orgId, contactId: "", conversationId: "", contactName: "", contactPhone: "" },
    sampleInput
  );
}
