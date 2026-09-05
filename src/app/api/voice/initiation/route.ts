import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
import { ensureAgentProfile } from "@/modules/agent/profile";
import { buildKnowledgeDigest } from "@/modules/knowledge/digest";
import { buildCallInit } from "@/modules/voice/initiation";
import { voiceUsage } from "@/modules/voice/usage";

/**
 * ElevenLabs "conversation initiation client data" webhook — fires when a
 * call rings. We resolve the dialled number to an org and hand back that
 * business's prompt, opener, language and voice for this one call.
 */

function secretOk(header: string | null): boolean {
  const expected = env.VOICE_INITIATION_SECRET ?? "";
  if (!expected || !header || header.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

const e164 = (raw: string | undefined) => {
  const digits = (raw ?? "").replace(/[^\d]/g, "");
  return digits ? `+${digits}` : "";
};

export async function POST(request: Request) {
  if (!secretOk(request.headers.get("x-nudge-voice-secret"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    caller_id?: string;
    called_number?: string;
  };
  const called = e164(body.called_number);
  const caller = e164(body.caller_id);

  // A phone call names the business by the number it dialled. A browser or
  // dashboard test call names nothing, so it may only reach the one workspace
  // VOICE_TEST_ORG_ID points at — we never guess a tenant from client input.
  const number = called
    ? await prisma.voiceNumber.findFirst({ where: { phoneE164: called, enabled: true } })
    : env.VOICE_TEST_ORG_ID
      ? ((await prisma.voiceNumber.findFirst({
          where: { orgId: env.VOICE_TEST_ORG_ID, enabled: true },
        })) ?? {
          orgId: env.VOICE_TEST_ORG_ID,
          phoneE164: "browser",
          language: "en",
          voiceId: null,
          transferTo: null,
        })
      : null;
  if (!number) {
    return NextResponse.json({ error: "unknown number" }, { status: 404 });
  }
  const org = await prisma.org.findUnique({
    where: { id: number.orgId },
    select: { id: true, timezone: true },
  });
  if (!org) {
    return NextResponse.json({ error: "unknown workspace" }, { status: 404 });
  }

  const profile = await ensureAgentProfile(number.orgId);
  if (!profile || !profile.enabled) {
    return NextResponse.json({ error: "agent disabled" }, { status: 404 });
  }

  // The package's call minutes are a hard ceiling: with none left we hand back
  // no agent, so the call never becomes a billable conversation.
  const usage = await voiceUsage(number.orgId, 1);
  if (usage.exhausted) {
    return NextResponse.json(
      { error: "call minutes exhausted", used: usage.used, limit: usage.limit },
      { status: 402 }
    );
  }

  const [contact, entries] = await Promise.all([
    caller
      ? prisma.contact.findUnique({
          where: { orgId_phoneE164: { orgId: number.orgId, phoneE164: caller } },
        })
      : Promise.resolve(null),
    prisma.knowledgeEntry.findMany({
      where: { orgId: number.orgId, status: "active" },
      select: { category: true, fact: true, condition: true },
      orderBy: { createdAt: "asc" },
      take: 400,
    }),
  ]);

  const init = buildCallInit({
    org: { id: number.orgId, timezone: org.timezone },
    number: {
      phoneE164: number.phoneE164,
      language: number.language,
      voiceId: number.voiceId,
      transferTo: number.transferTo,
    },
    profile: {
      vertical: profile.vertical,
      businessName: profile.businessName,
      businessInfo: profile.businessInfo,
      tone: profile.tone,
      doNots: profile.doNots,
    },
    knowledgeDigest: buildKnowledgeDigest(entries),
    contact: { name: contact?.name ?? caller, phoneE164: caller },
    purpose: "inbound",
    now: new Date(),
  });
  return NextResponse.json(init);
}
