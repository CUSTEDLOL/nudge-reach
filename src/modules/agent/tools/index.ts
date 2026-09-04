import type { AgentToolDef, ToolInvocation } from "@/lib/model-router";
import type { AgentTool, ToolContext } from "@/modules/agent/tools/types";
import { handoffTool, HANDOFF_TOOL_NAME } from "@/modules/agent/tools/handoff";
import { captureLeadTool } from "@/modules/agent/tools/capture-lead";
import { captureBookingTool } from "@/modules/agent/tools/capture-booking";
import { askOwnerTool } from "@/modules/agent/tools/ask-owner";
import { sendPaymentLinkTool } from "@/modules/agent/tools/send-payment-link";

export type { ToolContext } from "@/modules/agent/tools/types";
export { HANDOFF_TOOL_NAME } from "@/modules/agent/tools/handoff";

/** The worker's tool belt. Keep it small and sharp. */
const TOOLS: AgentTool[] = [
  handoffTool,
  captureLeadTool,
  captureBookingTool,
  askOwnerTool,
  sendPaymentLinkTool,
];
const BY_NAME = new Map(TOOLS.map((t) => [t.def.name, t]));

/** Reserved names a per-org custom action may never shadow (E2). */
export const BUILTIN_TOOL_NAMES: ReadonlySet<string> = new Set(BY_NAME.keys());

/** Schemas handed to the model. */
export function toolDefs(): AgentToolDef[] {
  return TOOLS.map((t) => t.def);
}

/**
 * Execute one model-requested tool call, scoped + validated. Never throws.
 * `extraTools` carries the org's custom actions (E2) — built-ins always win
 * a name collision.
 */
export async function runTool(
  ctx: ToolContext,
  call: ToolInvocation,
  extraTools: AgentTool[] = []
): Promise<{ result: string; isError?: boolean }> {
  const tool =
    BY_NAME.get(call.name) ?? extraTools.find((t) => t.def.name === call.name);
  if (!tool) {
    return { result: `Unknown tool "${call.name}".`, isError: true };
  }
  return tool.parseAndRun(ctx, call.input);
}

/** Did the agent escalate to a human in this turn? */
export function calledHandoff(calls: ToolInvocation[]): boolean {
  return calls.some((c) => c.name === HANDOFF_TOOL_NAME);
}
