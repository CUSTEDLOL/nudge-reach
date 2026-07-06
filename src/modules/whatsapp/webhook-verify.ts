import crypto from "node:crypto";

/**
 * Webhook helpers — pure, unit-tested.
 */

/** Verify Meta's X-Hub-Signature-256 header against the raw body. */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string
): boolean {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = crypto
    .createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest("hex");
  const provided = signatureHeader.slice("sha256=".length);
  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(
    Buffer.from(provided, "hex"),
    Buffer.from(expected, "hex")
  );
}

/** Inbound message text that means "opt me out". */
export function isStopMessage(text: string): boolean {
  return /^\s*(stop|unsubscribe|opt[\s-]?out)\b/i.test(text);
}
