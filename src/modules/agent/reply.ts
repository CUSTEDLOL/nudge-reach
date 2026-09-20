import { chat, runAgent, type ChatTurn } from "@/lib/model-router";
import { normalizeWhatsAppMarkdown } from "@/modules/inbox/format";
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
import { CreditsExhaustedError } from "@/modules/billing/credits";

export interface AgentReply {
  text: string;
  handoff: boolean;
  /**
   * The model call failed (provider outage, timeout, bad key, a BYOK model id
   * the provider rejects): handed off so the customer still hears back.
   * Distinct from a handoff the agent chose to make, and from
   * `pausedForCredits`, which is a billing state rather than a fault.
   */
  aiFailed?: true;
}

const HANDOFF_MESSAGE =
  "Thanks for your message! One of our team will get back to you shortly. 🙏";

/**
 * A provider failure must never leave a customer in silence. On the live
 * webhook the inbound message is stored before the model runs, so Meta's
 * redelivery is skipped as a duplicate and nobody ever answers. Degrade to
 * the hand-off line instead: the customer hears back, the thread is flagged
 * "Needs human", and the error is logged.
 */
function aiFailedReply(
  where: string,
  ctx: Pick<ToolContext, "orgId" | "conversationId">,
  err: unknown
): AgentReply & { actions: string[] } {
  console.error("[agent] reply failed; handing off", {
    where,
    orgId: ctx.orgId,
    conversationId: ctx.conversationId,
    error: err instanceof Error ? err.message : String(err),
  });
  return { text: HANDOFF_MESSAGE, handoff: true, aiFailed: true, actions: [] };
}

/**
 * Turn the scoped system prompt + conversation history into a reply.
 * If the model emits the handoff sentinel, swap in a friendly human-handoff
 * line and flag the conversation for a person.
 */
export async function generateAgentReply(
  profile: AgentProfileInput,
  history: ChatTurn[],
  ctx: Pick<ToolContext, "orgId" | "conversationId">,
  promptOptions: Omit<AgentPromptOptions, "withTools"> = {}
): Promise<AgentReply> {
  const system = buildAgentSystemPrompt(profile, promptOptions);
  let raw: string;
  try {
    raw = await chat({
      system,
      messages: history,
      maxTokens: 400,
      attribution: {
        orgId: ctx.orgId,
        conversationId: ctx.conversationId,
        purpose: "agent_reply",
      },
    });
  } catch (err) {
    return aiFailedReply("generateAgentReply", ctx, err);
  }

  if (!raw || raw.includes(HANDOFF_SENTINEL)) {
    return { text: HANDOFF_MESSAGE, handoff: true };
  }
  return { text: normalizeWhatsAppMarkdown(raw), handoff: false };
}

export interface AgentActionReply extends AgentReply {
  /** Tools the agent invoked this turn (for logging / the inbox timeline). */
  actions: string[];
  /** The org's AI credits are used up: handed off without calling the model. */
  pausedForCredits?: true;
}

/**
 * The "worker" reply: the agent may call tools (capture lead / booking / hand
 * off) before answering. Falls back to a safe handoff line if the model
 * returns nothing — or if the org's credit balance is at zero, so the customer
 * still hears back and a human picks the thread up.
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

  let text: string;
  let toolCalls: Awaited<ReturnType<typeof runAgent>>["toolCalls"];
  try {
    ({ text, toolCalls } = await runAgent({
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
    }));
  } catch (err) {
    if (err instanceof CreditsExhaustedError) {
      return { text: HANDOFF_MESSAGE, handoff: true, actions: [], pausedForCredits: true };
    }
    return aiFailedReply("generateAgentActionReply", ctx, err);
  }

  const handoff = calledHandoff(toolCalls);
  const actions = toolCalls.map((c) => c.name);

  if (!text) {
    return { text: HANDOFF_MESSAGE, handoff: true, actions };
  }
  return { text: normalizeWhatsAppMarkdown(text), handoff, actions };
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
