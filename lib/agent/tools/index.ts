import type { AgentToolDef, ToolInvocation } from "@/lib/model-router";
import type { AgentTool, ToolContext } from "@/lib/agent/tools/types";
import { handoffTool, HANDOFF_TOOL_NAME } from "@/lib/agent/tools/handoff";
import { captureLeadTool } from "@/lib/agent/tools/capture-lead";
import { captureBookingTool } from "@/lib/agent/tools/capture-booking";

export type { ToolContext } from "@/lib/agent/tools/types";
export { HANDOFF_TOOL_NAME } from "@/lib/agent/tools/handoff";

/** The worker's tool belt (Milestone 1). Keep it small and sharp. */
const TOOLS: AgentTool[] = [handoffTool, captureLeadTool, captureBookingTool];
const BY_NAME = new Map(TOOLS.map((t) => [t.def.name, t]));

/** Schemas handed to the model. */
export function toolDefs(): AgentToolDef[] {
  return TOOLS.map((t) => t.def);
}

/** Execute one model-requested tool call, scoped + validated. Never throws. */
export async function runTool(
  ctx: ToolContext,
  call: ToolInvocation
): Promise<{ result: string; isError?: boolean }> {
  const tool = BY_NAME.get(call.name);
  if (!tool) {
    return { result: `Unknown tool "${call.name}".`, isError: true };
  }
  return tool.parseAndRun(ctx, call.input);
}

/** Did the agent escalate to a human in this turn? */
export function calledHandoff(calls: ToolInvocation[]): boolean {
  return calls.some((c) => c.name === HANDOFF_TOOL_NAME);
}
