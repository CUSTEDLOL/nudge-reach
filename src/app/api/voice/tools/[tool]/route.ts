import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { isVoiceTool, runVoiceTool } from "@/modules/voice/tools";

/**
 * Webhook tools for the voice agent. `org_id` comes from the dynamic
 * variables we set at call start (from the dialled number) and the route is
 * bearer-gated, so a caller cannot act on another business without the secret.
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
  const { org_id, contact_phone, conversation_id: _conversationId, ...input } = body;
  void _conversationId;
  if (typeof org_id !== "string" || typeof contact_phone !== "string") {
    return NextResponse.json({ error: "org_id and contact_phone required" }, { status: 400 });
  }
  const digits = contact_phone.replace(/[^\d]/g, "");
  const out = await runVoiceTool(tool, org_id, `+${digits}`, input);
  return NextResponse.json({ result: out.result });
}
