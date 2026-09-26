import "server-only";
import { randomBytes } from "node:crypto";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";

export class ClientConnectionError extends Error {}

/** Caller must authenticate and require workspace ADMIN before saving. */
export async function saveClientConnection(input: {
  orgId: string; appId: string; appSecret: string;
}) {
  const appId = input.appId.trim();
  const appSecret = input.appSecret.trim();
  if (!/^\d{5,40}$/.test(appId) || !/^[a-f0-9]{32}$/i.test(appSecret)) {
    throw new ClientConnectionError("Enter the App ID and 32-character App Secret from Meta → App settings → Basic.");
  }
  // App IDs are public. Prove possession of the matching secret before
  // reserving the unique ID so another tenant cannot squat on it.
  if (env.SEND_MODE !== "simulation") {
    let response: Response;
    try {
      response = await fetch(`https://graph.facebook.com/${env.WHATSAPP_API_VERSION || "v23.0"}/${appId}?fields=id`, {
        headers: { Authorization: `Bearer ${appId}|${appSecret}` },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new ClientConnectionError("Meta could not be reached. Nothing was saved. Try again.");
    }
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.id !== appId) {
      throw new ClientConnectionError("Meta rejected the App ID or App Secret. Check App settings → Basic and try again.");
    }
  }
  const owner = await prisma.whatsappConnection.findUnique({ where: { appId } });
  if (owner && owner.orgId !== input.orgId) {
    throw new ClientConnectionError("That Meta app is already connected to another workspace.");
  }
  const credentials = {
    appId,
    appSecretEncrypted: encryptSecret(appSecret),
    verifyTokenEncrypted: encryptSecret(randomBytes(32).toString("hex")),
  };
  // Unique appId also closes the concurrent cross-workspace claim race.
  return prisma.whatsappConnection.upsert({
    where: { orgId: input.orgId },
    create: { orgId: input.orgId, ...credentials, webhookKey: randomBytes(24).toString("hex") },
    update: { ...credentials, verifiedAt: null, lastInboundAt: null },
  });
}
