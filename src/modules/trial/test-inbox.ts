import type { ThreadMessage } from "@/modules/inbox/queries";
import type { TrialReplySummary } from "./replies";

export interface TrialTestMessage {
  id: string;
  speaker: "customer" | "nudge";
  body: string;
  createdAt: string;
  optimistic?: boolean;
}

export interface TrialTestInboxState extends TrialReplySummary {
  messages: TrialTestMessage[];
  phase: "idle" | "sending" | "ready" | "error";
  composerEnabled: boolean;
  announcement: string;
}

export type TrialTestInboxEvent =
  | { type: "sent"; body: string }
  | {
      type: "snapshot";
      messages: ThreadMessage[];
      trial?: TrialReplySummary;
    }
  | { type: "failed"; trial?: TrialReplySummary };

function canCompose(status: TrialReplySummary["status"]) {
  return status === "active";
}

export function createTrialTestInboxState(
  trial: TrialReplySummary,
): TrialTestInboxState {
  return {
    ...trial,
    messages: [],
    phase: "idle",
    composerEnabled: canCompose(trial.status),
    announcement: "",
  };
}

function snapshotMessages(messages: ThreadMessage[]): TrialTestMessage[] {
  return messages
    .filter((message) => message.direction === "inbound" || message.direction === "outbound")
    .map((message) => ({
      id: message.id,
      speaker: message.direction === "inbound" ? "customer" : "nudge",
      body: message.body,
      createdAt: message.createdAt,
    }));
}

export function reduceTrialTestInbox(
  state: TrialTestInboxState,
  event: TrialTestInboxEvent,
): TrialTestInboxState {
  if (event.type === "sent") {
    return {
      ...state,
      phase: "sending",
      composerEnabled: false,
      announcement: "",
      messages: [
        ...state.messages.filter((message) => !message.optimistic),
        {
          id: "optimistic-customer-message",
          speaker: "customer",
          body: event.body,
          createdAt: "",
          optimistic: true,
        },
      ],
    };
  }

  const trial = event.trial ?? state;
  if (event.type === "failed") {
    return {
      ...state,
      ...trial,
      messages: state.messages.filter((message) => !message.optimistic),
      phase: "error",
      composerEnabled: canCompose(trial.status),
      announcement: "",
    };
  }

  const messages = snapshotMessages(event.messages);
  const lastReply = messages.findLast((message) => message.speaker === "nudge");
  return {
    ...state,
    ...trial,
    messages,
    phase: "ready",
    composerEnabled: canCompose(trial.status),
    announcement: lastReply?.body ?? "",
  };
}

/** Stable fake customer input. The server derives and returns it per tenant. */
export function trialTestIdentity(orgId: string) {
  let hash = 2_166_136_261;
  for (const character of orgId) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }
  const suffix = (hash >>> 0) % 1_000_000_000;
  return {
    label: "Test customer · private simulation",
    phone: String(7_000_000_000 + suffix),
  };
}

export function trialConversationDestination(
  acquisitionTrial: boolean,
  conversationId: string,
) {
  return acquisitionTrial ? null : `/inbox/${conversationId}`;
}
