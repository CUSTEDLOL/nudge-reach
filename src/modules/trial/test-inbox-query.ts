import "server-only";
import { prisma } from "@/lib/db";
import type { ThreadMessage } from "@/modules/inbox/queries";
import { trialSandboxAddress } from "./test-inbox";

const THREAD_LIMIT = 200;

function serializeMessages(
  messages: Array<{
    id: string;
    direction: string;
    body: string;
    createdAt: Date;
    metaMessageId: string | null;
  }>,
): ThreadMessage[] {
  return messages.map((message) => ({
    ...message,
    createdAt: message.createdAt.toISOString(),
  }));
}

const messageSelection = {
  orderBy: { createdAt: "asc" as const },
  take: THREAD_LIMIT,
  select: {
    id: true,
    direction: true,
    body: true,
    createdAt: true,
    metaMessageId: true,
  },
};

/** Org-scoped persisted history for the single acquisition-trial sandbox. */
export async function getTrialTestConversation(orgId: string): Promise<{
  conversationId: string | null;
  messages: ThreadMessage[];
}> {
  const conversation = await prisma.conversation.findFirst({
    where: {
      orgId,
      contact: { phoneE164: trialSandboxAddress(orgId) },
    },
    select: {
      id: true,
      messages: messageSelection,
    },
  });

  return {
    conversationId: conversation?.id ?? null,
    messages: serializeMessages(conversation?.messages ?? []),
  };
}

export interface TrialReadOnlyConversation {
  id: string;
  status: string;
  lastInboundAt: string | null;
  messages: ThreadMessage[];
}

/** A trial may open only its deterministic sandbox thread, never paid inbox data. */
export async function getTrialReadOnlyConversation(
  orgId: string,
  conversationId: string,
): Promise<TrialReadOnlyConversation | null> {
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      orgId,
      contact: { phoneE164: trialSandboxAddress(orgId) },
    },
    select: {
      id: true,
      status: true,
      lastInboundAt: true,
      messages: messageSelection,
    },
  });
  if (!conversation) return null;

  return {
    id: conversation.id,
    status: conversation.status,
    lastInboundAt: conversation.lastInboundAt?.toISOString() ?? null,
    messages: serializeMessages(conversation.messages),
  };
}
