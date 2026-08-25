import { env } from "@/lib/env";
import { prisma } from "@/lib/db";

export type SendMode = "simulation" | "live";

/**
 * The org's effective mode. The global SEND_MODE=simulation kill switch wins
 * (the whole product must demo with zero keys — invariant #4); in live
 * deployments each org stays mocked until its own WhatsApp number is
 * connected, so a fresh signup and the /demo sandbox never touch Meta.
 */
export function sendModeFor(org: { simulated: boolean }): SendMode {
  if (env.SEND_MODE === "simulation") return "simulation";
  return org.simulated ? "simulation" : "live";
}

export function isSimulated(org: { simulated: boolean }): boolean {
  return sendModeFor(org) === "simulation";
}

/** Same rule for code paths that only hold an orgId. */
export async function orgSendMode(orgId: string): Promise<SendMode> {
  if (env.SEND_MODE === "simulation") return "simulation";
  const org = await prisma.org.findUnique({
    where: { id: orgId },
    select: { simulated: true },
  });
  return org ? sendModeFor(org) : "simulation";
}
