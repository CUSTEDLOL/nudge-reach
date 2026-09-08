export type ReasonResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

/** Exact, case-insensitive typed confirmation with surrounding space ignored. */
export function confirmationMatches(expected: string, actual: string): boolean {
  return expected.trim().toLowerCase() === actual.trim().toLowerCase();
}

/** A concise reason stored in the client-visible audit trail. */
export function requireReason(reason: string | null | undefined): ReasonResult {
  const value = reason?.trim() ?? "";
  if (value.length < 3) {
    return { ok: false, error: "Give a reason of at least 3 characters." };
  }
  if (value.length > 500) {
    return { ok: false, error: "Keep the reason to 500 characters or fewer." };
  }
  return { ok: true, value };
}

export function founderActionReady({
  reasonRequired,
  reason,
  confirmationExpected,
  confirmation,
}: {
  reasonRequired: boolean;
  reason: string;
  confirmationExpected?: string;
  confirmation: string;
}): boolean {
  if (reasonRequired && !requireReason(reason).ok) return false;
  if (
    confirmationExpected !== undefined &&
    !confirmationMatches(confirmationExpected, confirmation)
  ) {
    return false;
  }
  return true;
}
