import { prisma } from "@/lib/db";

/**
 * The one database read of AgentRule on the reply path.
 *
 * It lives beside `modules/agent/rules.ts` rather than inside it so that
 * module stays pure (zod + string helpers), shared unchanged by the authoring
 * UI, the server actions and the prompt builder.
 *
 * Org-scoped (invariant #5) and ordered exactly as the owner arranged them:
 * `order` is the drag handle, `createdAt` breaks ties between rows that share
 * one. `limit` is the caller's — trial workspaces allow fewer active rules
 * than full ones (`MAX_ACTIVE_RULES`).
 */
export async function activeRules(
  orgId: string,
  limit: number
): Promise<{ instruction: string }[]> {
  return prisma.agentRule.findMany({
    where: { orgId, status: "active" },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    take: limit,
    select: { instruction: true },
  });
}
