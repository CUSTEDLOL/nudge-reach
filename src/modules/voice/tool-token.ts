import crypto from "node:crypto";

const VERSION = "v1";
const DEFAULT_TTL_SECS = 15 * 60;

export type VoiceCallSource = "phone" | "browser";

function payload(input: {
  orgId: string;
  contactPhone: string;
  source: VoiceCallSource;
  expiresAt: number;
}) {
  return [VERSION, input.expiresAt, input.source, input.orgId, input.contactPhone].join("|");
}

/** Scope client-visible dynamic variables to one tenant, caller and short call window. */
export function createVoiceToolToken(
  input: { orgId: string; contactPhone: string; source: VoiceCallSource },
  secret: string,
  nowSecs = Math.floor(Date.now() / 1000)
): string {
  const expiresAt = nowSecs + DEFAULT_TTL_SECS;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(payload({ ...input, expiresAt }))
    .digest("base64url");
  return `${VERSION}.${expiresAt}.${signature}`;
}

export function verifyVoiceToolToken(
  token: string,
  input: { orgId: string; contactPhone: string; source: VoiceCallSource },
  secret: string,
  nowSecs = Math.floor(Date.now() / 1000),
  /** Post-call delivery may lag; tool routes leave this at zero. */
  expiryGraceSecs = 0
): boolean {
  const [version, rawExpiry, supplied] = token.split(".");
  const expiresAt = Number(rawExpiry);
  if (
    version !== VERSION ||
    !Number.isInteger(expiresAt) ||
    expiresAt + expiryGraceSecs < nowSecs ||
    !supplied
  ) {
    return false;
  }
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload({ ...input, expiresAt }))
    .digest("base64url");
  if (expected.length !== supplied.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(supplied));
}
