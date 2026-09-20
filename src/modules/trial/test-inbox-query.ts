import "server-only";
import { prisma } from "@/lib/db";
import type { ThreadMessage } from "@/modules/inbox/queries";
import { trialSandboxAddress } from "./test-inbox";

const THREAD_LIMIT = 200;

/** Org-scoped persisted history for the single acquisition-trial sandbox. */
export async function getTrialTestMessages(orgId: string): Promise<ThreadMessage[]> {
  const conversation = await prisma.conversation.findFirst({
    where: {
      orgId,
      contact: { phoneE164: trialSandboxAddress(orgId) },
    },
    select: {
      messages: {
        orderBy: { createdAt: "asc" },
        take: THREAD_LIMIT,
        select: {
          id: true,
          direction: true,
          body: true,
          createdAt: true,
          metaMessageId: true,
        },
      },
    },
  });

  return (conversation?.messages ?? []).map((message) => ({
    ...message,
    createdAt: message.createdAt.toISOString(),
  }));
}
