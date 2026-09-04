import { chat, runAgent, type ChatTurn } from "@/lib/model-router";
import {
  buildAgentSystemPrompt,
  HANDOFF_SENTINEL,
  type AgentProfileInput,
  type AgentPromptOptions,
} from "@/modules/agent/prompt";
import {
  calledHandoff,
  runTool,
  toolDefs,
  type ToolContext,
} from "@/modules/agent/tools";
import { loadCustomTools } from "@/modules/agent/tools/custom";

export interface AgentReply {
  text: string;
  handoff: boolean;
}

const HANDOFF_MESSAGE =
  "Thanks for your message! One of our team will get back to you shortly. 🙏";

/**
 * Turn the scoped system prompt + conversation history into a reply.
 * If the model emits the handoff sentinel, swap in a friendly human-handoff
 * line and flag the conversation for a person.
 */
export async function generateAgentReply(
  profile: AgentProfileInput,
  history: ChatTurn[],
  promptOptions: Omit<AgentPromptOptions, "withTools"> = {}
): Promise<AgentReply> {
  const system = buildAgentSystemPrompt(profile, promptOptions);
  const raw = await chat({ system, messages: history, maxTokens: 400 });

  if (!raw || raw.includes(HANDOFF_SENTINEL)) {
    return { text: HANDOFF_MESSAGE, handoff: true };
  }
  return { text: raw, handoff: false };
}

export interface AgentActionReply extends AgentReply {
  /** Tools the agent invoked this turn (for logging / the inbox timeline). */
  actions: string[];
}

/**
 * The "worker" reply: the agent may call tools (capture lead / booking / hand
 * off) before answering. Falls back to a safe handoff line if the model
 * returns nothing.
 */
export async function generateAgentActionReply(
  profile: AgentProfileInput,
  history: ChatTurn[],
  ctx: ToolContext,
  promptOptions: Omit<AgentPromptOptions, "withTools"> = {}
): Promise<AgentActionReply> {
  // The org's own connected actions (E2) ride alongside the built-ins.
  const customTools = await loadCustomTools(ctx.orgId);
  const system = buildAgentSystemPrompt(profile, {
    ...promptOptions,
    withTools: true,
    customTools: customTools.map((t) => ({
      name: t.def.name,
      description: t.def.description,
    })),
  });

  const { text, toolCalls } = await runAgent({
    system,
    messages: history,
    tools: [...toolDefs(), ...customTools.map((t) => t.def)],
    runTool: (call) => runTool(ctx, call, customTools),
    maxTokens: 500,
    maxSteps: 5,
    attribution: {
      orgId: ctx.orgId,
      conversationId: ctx.conversationId,
      purpose: "agent_reply",
    },
  });

  const handoff = calledHandoff(toolCalls);
  const actions = toolCalls.map((c) => c.name);

  if (!text) {
    return { text: HANDOFF_MESSAGE, handoff: true, actions };
  }
  return { text, handoff, actions };
}

/**
 * Build an alternating user/assistant transcript from stored messages.
 * inbound → user, outbound → assistant. Consecutive same-role turns are merged
 * (the API wants the conversation to start with a user turn and read cleanly).
 */
export function buildHistory(
  messages: { direction: string; body: string }[]
): ChatTurn[] {
  const turns: ChatTurn[] = [];
  for (const m of messages) {
    const role: ChatTurn["role"] =
      m.direction === "inbound" ? "user" : "assistant";
    const last = turns[turns.length - 1];
    if (last && last.role === role) {
      last.text += `\n${m.body}`;
    } else {
      turns.push({ role, text: m.body });
    }
  }
  // Conversation must begin with a user turn.
  while (turns.length && turns[0].role !== "user") turns.shift();
  return turns;
}
