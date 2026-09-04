import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { realProvider } from "@/modules/crm/providers";
import { simulationProvider } from "@/modules/crm/providers/simulation";
import type { ConnectionRow, CrmProvider, CrmProviderKey, CrmTokens } from "@/modules/crm/types";

/**
 * Per-org CRM connections: tokens encrypted at rest (AES-256-GCM via
 * lib/crypto), access tokens refreshed just in time. Simulation rule mirrors
 * messaging: global simulation or a simulated org never touches a real CRM.
 */

const REFRESH_SKEW_MS = 60_000;

export function providerFor(key: CrmProviderKey, org: { simulated: boolean }): CrmProvider {
  if (env.SEND_MODE === "simulation" || org.simulated) return simulationProvider;
  return realProvider(key) ?? simulationProvider;
}

export async function saveConnection(
  orgId: string,
  key: CrmProviderKey,
  tokens: CrmTokens,
  simulated: boolean
) {
  const data = {
    accountLabel: tokens.accountLabel,
    apiDomain: tokens.apiDomain,
    accountsServer: tokens.accountsServer,
    refreshTokenEncrypted: encryptSecret(tokens.refreshToken),
    accessTokenEncrypted: encryptSecret(tokens.accessToken),
    accessTokenExpiresAt: new Date(Date.now() + tokens.expiresInSecs * 1000),
    status: "connected",
    lastError: null,
    simulated,
  };
  return prisma.crmConnection.upsert({
    where: { orgId_provider: { orgId, provider: key } },
    create: { orgId, provider: key, ...data },
    update: data,
  });
}

/** Decrypt the connection and make sure the access token is fresh. */
export async function withAccessToken(connId: string): Promise<ConnectionRow> {
  const row = await prisma.crmConnection.findUniqueOrThrow({ where: { id: connId } });
  const key = row.provider as CrmProviderKey;
  const provider = realProvider(key);
  let accessToken = row.accessTokenEncrypted ? decryptSecret(row.accessTokenEncrypted) : "";
  const expired =
    !row.accessTokenExpiresAt || row.accessTokenExpiresAt.getTime() < Date.now() + REFRESH_SKEW_MS;
  if (provider && (expired || !accessToken)) {
    const fresh = await provider.refresh({
      refreshToken: decryptSecret(row.refreshTokenEncrypted),
      accountsServer: row.accountsServer,
    });
    accessToken = fresh.accessToken;
    await prisma.crmConnection.update({
      where: { id: row.id },
      data: {
        accessTokenEncrypted: encryptSecret(fresh.accessToken),
        accessTokenExpiresAt: new Date(Date.now() + fresh.expiresInSecs * 1000),
      },
    });
  }
  return {
    id: row.id,
    orgId: row.orgId,
    provider: key,
    apiDomain: row.apiDomain,
    accountsServer: row.accountsServer,
    accessToken,
  };
}

export async function disconnect(orgId: string, key: CrmProviderKey) {
  await prisma.crmConnection.updateMany({ where: { orgId, provider: key }, data: { status: "disconnected" } });
}

export async function listConnections(orgId: string) {
  return prisma.crmConnection.findMany({ where: { orgId }, orderBy: { createdAt: "asc" } });
}
