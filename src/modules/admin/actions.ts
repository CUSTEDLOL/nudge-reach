import { requireFounder, type FounderContext } from "@/modules/admin/auth";
import type { OwnerSetupLink } from "@/modules/orgs/owner-setup";

export interface AdminActionResult {
  ok: boolean;
  message: string;
  setupLink?: OwnerSetupLink;
}

const SAFE_FAILURE_MESSAGE =
  "That change could not be completed. Nothing else was changed. Try again.";

/**
 * Applies the founder-only gate before privileged work and gives admin forms a
 * stable, non-sensitive failure result for unexpected operational errors.
 */
export async function runFounderAction(
  work: (founder: FounderContext) => Promise<AdminActionResult>
): Promise<AdminActionResult> {
  const founder = await requireFounder();

  try {
    return await work(founder);
  } catch {
    return { ok: false, message: SAFE_FAILURE_MESSAGE };
  }
}
