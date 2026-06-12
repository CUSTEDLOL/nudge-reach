import type { MessageStatus } from "@prisma/client";

/**
 * Simulation-mode delivery lifecycle (rule 5): deterministic, time-based
 * status progression so the dashboard fills in realistically and the same
 * message always follows the same path. Pure function — unit-tested.
 *
 * Timeline after send: delivered ~4s, read ~12s, clicked ~20s.
 * ~93% deliver; of those ~75% read; of those ~30% click.
 */

/** Stable tiny hash → [0, 1). FNV-1a + murmur3 finalizer for good spread. */
export function seededFraction(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function simulatedStatusFor(
  messageId: string,
  sentAtMs: number,
  nowMs: number
): MessageStatus {
  const elapsed = (nowMs - sentAtMs) / 1000;
  if (elapsed < 0) return "SENT";

  const roll = seededFraction(messageId);
  if (roll > 0.93) return elapsed >= 4 ? "FAILED" : "SENT";

  if (elapsed < 4) return "SENT";
  if (elapsed < 12) return "DELIVERED";

  const reads = seededFraction(`${messageId}:read`) < 0.75;
  if (!reads) return "DELIVERED";
  if (elapsed < 20) return "READ";

  const clicks = seededFraction(`${messageId}:click`) < 0.3;
  return clicks ? "CLICKED" : "READ";
}

/** Forward-only ranking — webhooks can arrive out of order. */
const RANK: Record<MessageStatus, number> = {
  QUEUED: 0,
  SENT: 1,
  DELIVERED: 2,
  READ: 3,
  CLICKED: 4,
  FAILED: 5, // terminal
};

export function isForwardTransition(
  from: MessageStatus,
  to: MessageStatus
): boolean {
  if (from === "FAILED") return false;
  if (to === "FAILED") return from !== "READ" && from !== "CLICKED";
  return RANK[to] > RANK[from];
}
