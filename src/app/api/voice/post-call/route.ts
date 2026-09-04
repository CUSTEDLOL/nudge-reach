import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
import { verifyElevenLabsSignature } from "@/modules/voice/drivers/elevenlabs";
import { fileCall } from "@/modules/voice/file-call";
import { parsePostCall } from "@/modules/voice/transcript";

/** ElevenLabs post-call webhook (HMAC-signed): the transcript lands in the inbox. */
export async function POST(request: Request) {
  const raw = await request.text();
  const secret = env.ELEVENLABS_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "voice webhook not configured" }, { status: 503 });
  }
  if (!verifyElevenLabsSignature(raw, request.headers.get("elevenlabs-signature"), secret)) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const call = parsePostCall(json);
  if (!call) return NextResponse.json({ ok: true, ignored: true });

  // Tenant: the business number on the call decides the org, never the body alone.
  const businessNumber = call.direction === "inbound" ? call.toE164 : call.fromE164;
  const number = businessNumber
    ? await prisma.voiceNumber.findUnique({ where: { phoneE164: businessNumber } })
    : null;
  const orgId = number?.orgId ?? (call.dynamicVariables.org_id || null);
  if (!orgId) return NextResponse.json({ ok: true, ignored: true });

  const purpose =
    (["inbound", "reminder", "no_show"] as const).find((p) => p === call.dynamicVariables.purpose) ??
    "inbound";
  await fileCall(orgId, call, purpose);
  return NextResponse.json({ ok: true });
}
