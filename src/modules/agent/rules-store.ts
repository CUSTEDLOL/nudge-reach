import { prisma } from "@/lib/db";
import { isRestrictedAcquisitionTrial } from "@/modules/trial/capabilities";
import { MAX_ACTIVE_RULES } from "@/modules/agent/rules";

/**
 * The one database read of AgentRule on the reply path.
 *
 * It lives beside `modules/agent/rules.ts` rather than inside it so that
 * module stays pure (zod + string helpers), shared unchanged by the authoring
 * UI, the server actions and the prompt builder.
 *
 * Org-scoped (invariant #5) and ordered by `order`, `createdAt` breaking ties
 * between rows that share one.
 *
 * `order` is INSERTION order and nothing more: `createRuleAction` numbers each
 * new rule past every row the org has (archived ones included, so restoring
 * one cannot collide), and no other write touches it. There is no way for an
 * owner to rearrange the list — this said `order` is the drag handle, which
 * described a `reorderRulesAction` no UI ever reached; it is gone. What the
 * column buys is a stable order across reads, so the prompt does not shuffle
 * the owner's rules between replies.
 *
 * `limit` is the caller's — trial workspaces allow fewer active rules than
 * full ones (`MAX_ACTIVE_RULES`).
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

/**
 * How many active rules this workspace is allowed — the ONE place that maps a
 * workspace to a `MAX_ACTIVE_RULES` entry. A restricted acquisition trial gets
 * the short list; everyone else gets the full one.
 *
 * It exists because three different files had written `? trial : full` by hand
 * and the voice path had simply written `.full`: correct only for as long as
 * no acquisition trial carries the `voiceAgent` capability, which is a fact
 * about today's plan table, not about this code. Derive the limit here and the
 * coupling is enforced rather than commented.
 */
export async function ruleLimitFor(orgId: string): Promise<number> {
  return (await isRestrictedAcquisitionTrial(orgId))
    ? MAX_ACTIVE_RULES.trial
    : MAX_ACTIVE_RULES.full;
}

/**
 * `activeRules` for a caller that does not already know the workspace's trial
 * state — one extra small query. The inbound reply path does know (it resolves
 * `restrictedTrial` for a dozen other decisions), so it keeps calling
 * `activeRules` with the limit it already has and pays for nothing twice.
 */
export async function activeRulesForOrg(
  orgId: string
): Promise<{ instruction: string }[]> {
  return activeRules(orgId, await ruleLimitFor(orgId));
}
