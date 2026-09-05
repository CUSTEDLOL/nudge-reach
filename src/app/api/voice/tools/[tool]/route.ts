import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { isVoiceTool, runVoiceTool } from "@/modules/voice/tools";
import { verifyVoiceToolToken, type VoiceCallSource } from "@/modules/voice/tool-token";

/**
 * Webhook tools for the voice agent. `org_id` comes from the dynamic
 * variables we set at call start. The bearer authenticates ElevenLabs; a
 * short-lived HMAC additionally binds tenant, caller and call source so browser
 * clients cannot edit those variables to act on another workspace.
 */

function bearerOk(header: string | null): boolean {
  const expected = `Bearer ${env.VOICE_TOOLS_SECRET ?? ""}`;
  if (!env.VOICE_TOOLS_SECRET || !header || header.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tool: string }> }
) {
  if (!bearerOk(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { tool } = await params;
  if (!isVoiceTool(tool)) return NextResponse.json({ error: "unknown tool" }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const {
    org_id,
    contact_phone,
    call_source,
    tool_token,
    conversation_id: _conversationId,
    ...input
  } = body;
  void _conversationId;
  if (
    typeof org_id !== "string" ||
    typeof contact_phone !== "string" ||
    (call_source !== "phone" && call_source !== "browser") ||
    typeof tool_token !== "string"
  ) {
    return NextResponse.json({ error: "invalid call context" }, { status: 400 });
  }
  const digits = contact_phone.replace(/[^\d]/g, "");
  if (!digits) return NextResponse.json({ error: "invalid caller" }, { status: 400 });
  const normalizedPhone = `+${digits}`;
  const source = call_source as VoiceCallSource;
  if (
    !verifyVoiceToolToken(
      tool_token,
      { orgId: org_id, contactPhone: normalizedPhone, source },
      env.VOICE_TOOLS_SECRET ?? ""
    )
  ) {
    return NextResponse.json({ error: "invalid call token" }, { status: 401 });
  }
  const out = await runVoiceTool(tool, org_id, normalizedPhone, source, input);
  return NextResponse.json({ result: out.result });
}
