import { chat, type ChatTurn } from "@/lib/model-router";
import {
  buildAgentSystemPrompt,
  HANDOFF_SENTINEL,
  type AgentProfileInput,
} from "@/lib/agent/prompt";

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
  history: ChatTurn[]
): Promise<AgentReply> {
  const system = buildAgentSystemPrompt(profile);
  const raw = await chat({ system, messages: history, maxTokens: 400 });

  if (!raw || raw.includes(HANDOFF_SENTINEL)) {
    return { text: HANDOFF_MESSAGE, handoff: true };
  }
  return { text: raw, handoff: false };
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
