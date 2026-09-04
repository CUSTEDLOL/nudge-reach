import crypto from "node:crypto";
import type { CrmProviderKey } from "@/modules/crm/types";

/**
 * OAuth `state`: which org + provider started the flow, HMAC-signed with the
 * app secret so a callback can't be forged onto another tenant.
 */

const PROVIDERS: CrmProviderKey[] = ["zoho", "salesforce", "sim"];

export function signState(
  orgId: string,
  provider: CrmProviderKey,
  secret: string,
  nonce = crypto.randomBytes(8).toString("hex")
): string {
  const payload = `${orgId}:${provider}:${nonce}`;
  const mac = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return Buffer.from(`${payload}:${mac}`).toString("base64url");
}

export function verifyState(
  state: string,
  secret: string
): { orgId: string; provider: CrmProviderKey } | null {
  let decoded: string;
  try {
    decoded = Buffer.from(state, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const parts = decoded.split(":");
  if (parts.length !== 4) return null;
  const [orgId, provider, nonce, mac] = parts;
  if (!PROVIDERS.includes(provider as CrmProviderKey)) return null;
  const expected = crypto.createHmac("sha256", secret).update(`${orgId}:${provider}:${nonce}`).digest("hex");
  if (expected.length !== mac.length || !/^[0-9a-f]+$/.test(mac)) return null;
  if (!crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(mac, "hex"))) return null;
  return { orgId, provider: provider as CrmProviderKey };
}
