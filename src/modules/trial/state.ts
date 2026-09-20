export const TRIAL_DAYS = 7;
export const TRIAL_REPLY_LIMIT = 15;
const DAY_MS = 86_400_000;

export type TrialStatus =
  | "pending"
  | "active"
  | "exhausted"
  | "expired"
  | "converted";

export interface TrialStateInput {
  orgId: string | null;
  claimedAt: Date | null;
  startedAt: Date | null;
  expiresAt: Date | null;
  repliesUsed: number;
  replyLimit: number;
  convertedAt: Date | null;
  subscriptionStatus: string;
}

export function trialEndsAt(startedAt: Date): Date {
  return new Date(startedAt.getTime() + TRIAL_DAYS * DAY_MS);
}

export function deriveTrialStatus(
  input: TrialStateInput,
  now: Date = new Date()
): TrialStatus {
  if (input.convertedAt || input.subscriptionStatus === "active") return "converted";
  if (!input.orgId || !input.claimedAt || !input.startedAt || !input.expiresAt) return "pending";
  if (now.getTime() >= input.expiresAt.getTime()) return "expired";
  if (input.repliesUsed >= input.replyLimit) return "exhausted";
  return "active";
}
