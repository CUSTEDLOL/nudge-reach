/**
 * Sandbox addresses: where "Try your AI" conversations live in a LIVE
 * workspace. +999 is unassigned by the ITU, so the number can never belong
 * to a person; sendMessage routes any sandbox address through the
 * simulation driver whatever the workspace mode, and Meta would reject it
 * anyway. Nothing typed into the tester can reach a real phone.
 */
export const SANDBOX_DIAL = "+999";

export function sandboxAddress(local: string): string {
  const digits = local.replace(/\D/g, "").slice(-12) || "1";
  return `${SANDBOX_DIAL}${digits}`;
}

export function isSandboxAddress(address: string): boolean {
  return address.startsWith(SANDBOX_DIAL);
}
