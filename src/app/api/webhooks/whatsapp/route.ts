import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { env } from "@/lib/env";
import { verifyWebhookSignature } from "@/modules/whatsapp/webhook-verify";
import { processWhatsappWebhook } from "@/modules/whatsapp/webhook-handler";

/**
 * WhatsApp Cloud API webhook: signature-verified, idempotent.
 * - message status updates (sent/delivered/read/failed + pricing)
 * - template status updates (approve/reject)
 * - inbound messages: STOP → permanent opt-out (rule 2)
 */

/** Constant-time string compare (mirrors the HMAC checks elsewhere). */
function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// Subscription verification handshake
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const expected = env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? "";
  if (
    searchParams.get("hub.mode") === "subscribe" &&
    expected.length > 0 &&
    timingSafeEqualStr(searchParams.get("hub.verify_token") ?? "", expected)
  ) {
    return new Response(searchParams.get("hub.challenge") ?? "", {
      status: 200,
    });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  if (!env.META_APP_SECRET) return NextResponse.json({ error: "webhook not configured" }, { status: 503 });
  const raw = await request.text();
  if (!verifyWebhookSignature(raw, request.headers.get("x-hub-signature-256"), env.META_APP_SECRET)) return NextResponse.json({ error: "bad signature" }, { status: 401 });
  return processWhatsappWebhook(raw);
}
