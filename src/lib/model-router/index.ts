import { env } from "@/lib/env";
import { assertRuntimeModelAllowed } from "@/lib/model-router/guard";
import { recordUsage, type Attribution } from "@/lib/model-router/usage";
import { anthropicDriver } from "@/lib/model-router/drivers/anthropic";
import { getByokRuntime } from "@/lib/model-router/byok";
import type {
  AgentToolDef,
  ChatTurn,
  DriverRuntime,
  LlmDriver,
  ToolInvocation,
} from "@/lib/model-router/types";

/**
 * Platform module: the ONLY doorway through which the app talks to an LLM.
 *
 * Rule 3 (AGENTS.md, amended E3): platform-paid AI stays on the cheap
 * Anthropic tier (RUNTIME_MODEL, guard-checked). Enterprise orgs may bring
 * their own OpenAI / Google / Anthropic key (their cost) — resolved per call
 * from the org on the attribution, through this same doorway.
 */

export type { AgentToolDef, ChatTurn, ToolInvocation } from "@/lib/model-router/types";

/**
 * A model reply truncated at maxTokens can end in half an emoji (an unpaired
 * UTF-16 surrogate), which Postgres rejects on insert. Strip lone surrogates
 * once here so no driver can leak one into the app.
 */
function sanitizeText(text: string): string {
  return text.replace(
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,
    ""
  );
}

export interface GenerateInput {
  system: string;
  prompt: string;
  /** Base64-encoded image for the vision path. */
  image?: {
    data: string;
    mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  };
  /** Base64-encoded PDF (document content block — supported on Haiku,
   * no beta header; 100-page cap on 200K-context models). */
  document?: {
    data: string;
  };
  maxTokens?: number;
  /** Org/conversation the call is billed to; omit only for unattributable calls. */
  attribution?: Attribution;
}

interface ResolvedRuntime {
  driver: LlmDriver;
  rt: DriverRuntime;
  byok: boolean;
}

/**
 * Pick the driver + model + key for one call. BYO-LLM (E3) wins when the
 * attributed org has a valid enterprise LlmAccount; everything else runs on
 * the platform's guarded Anthropic tier. `forcePlatform` pins paths a BYO
 * provider can't serve (PDF document ingest).
 */
async function resolveRuntime(
  attribution: Attribution | undefined,
  opts: { forcePlatform?: boolean } = {}
): Promise<ResolvedRuntime> {
  if (!opts.forcePlatform && attribution?.orgId) {
    const byok = await getByokRuntime(attribution.orgId);
    if (byok) return { driver: byok.driver, rt: byok.rt, byok: true };
  }
  const model = env.RUNTIME_MODEL || "claude-haiku-4-5";
  assertRuntimeModelAllowed(model);
  return {
    driver: anthropicDriver,
    rt: { model, apiKey: env.ANTHROPIC_API_KEY ?? "" },
    byok: false,
  };
}

export async function generate({
  system,
  prompt,
  image,
  document,
  maxTokens = 1024, // campaigns are short; keep the cap low to control cost
  attribution,
}: GenerateInput): Promise<string> {
  // PDF ingest stays on the platform driver — not all providers accept PDFs.
  const { driver, rt, byok } = await resolveRuntime(attribution, {
    forcePlatform: Boolean(document),
  });
  const { text, usage } = await driver.generate(rt, {
    system,
    prompt,
    image,
    document,
    maxTokens,
  });
  if (attribution) {
    recordUsage(attribution, rt.model, usage.inputTokens, usage.outputTokens, { byok });
  }
  return sanitizeText(text);
}

export interface ChatInput {
  system: string;
  messages: ChatTurn[];
  maxTokens?: number;
  /** Org/conversation the call is billed to; omit only for unattributable calls. */
  attribution?: Attribution;
}

/**
 * Multi-turn chat for the conversational agent. Same cheap-model guarantee
 * as generate() on the platform path; BYO orgs run their configured model.
 */
export async function chat({
  system,
  messages,
  maxTokens = 400, // WhatsApp replies are short; keep cost + latency low
  attribution,
}: ChatInput): Promise<string> {
  const { driver, rt, byok } = await resolveRuntime(attribution);
  const { text, usage } = await driver.chat(rt, { system, messages, maxTokens });
  if (attribution) {
    recordUsage(attribution, rt.model, usage.inputTokens, usage.outputTokens, { byok });
  }
  return sanitizeText(text);
}

export interface RunAgentInput {
  system: string;
  messages: ChatTurn[];
  tools: AgentToolDef[];
  /** Executes one tool call and returns a short result string for the model. */
  runTool: (call: ToolInvocation) => Promise<{ result: string; isError?: boolean }>;
  maxTokens?: number;
  /** Hard ceiling on model↔tool round trips (default 5). */
  maxSteps?: number;
  /** Org/conversation the call is billed to; omit only for unattributable calls. */
  attribution?: Attribution;
}

export interface RunAgentResult {
  /** The agent's final natural-language reply. */
  text: string;
  /** Every tool the agent actually invoked, in order. */
  toolCalls: ToolInvocation[];
  /** True if the loop hit maxSteps without a clean finish. */
  cappedOut: boolean;
}

/**
 * Tool/function-calling agent loop. The loop is HARD-CAPPED (maxSteps) so
 * the agent can chain tools but can never spin forever. The caller owns tool
 * execution via `runTool`, keeping all side effects (DB writes, tenant
 * scoping, validation) outside the model layer. One usage row per run.
 */
export async function runAgent({
  system,
  messages,
  tools,
  runTool,
  maxTokens = 500,
  maxSteps = 5,
  attribution,
}: RunAgentInput): Promise<RunAgentResult> {
  const { driver, rt, byok } = await resolveRuntime(attribution);
  const { text, toolCalls, cappedOut, usage } = await driver.runAgent(rt, {
    system,
    messages,
    tools,
    runTool,
    maxTokens,
    maxSteps,
  });
  if (attribution) {
    recordUsage(attribution, rt.model, usage.inputTokens, usage.outputTokens, { byok });
  }
  return { text: sanitizeText(text), toolCalls, cappedOut };
}
