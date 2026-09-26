import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { verifyWebhookSignature } from "@/modules/whatsapp/webhook-verify";
import { processWhatsappWebhook } from "@/modules/whatsapp/webhook-handler";

type Context = { params: Promise<{ connectionKey: string }> };
async function resolve(context: Context) {
  const { connectionKey } = await context.params;
  return prisma.whatsappConnection.findUnique({ where: { webhookKey: connectionKey } });
}
export async function GET(request: Request, context: Context) {
  const connection = await resolve(context);
  if (!connection) return new Response("Not found", { status: 404 });
  const query = new URL(request.url).searchParams;
  const expected = Buffer.from(decryptSecret(connection.verifyTokenEncrypted));
  const provided = Buffer.from(query.get("hub.verify_token") ?? "");
  if (query.get("hub.mode") !== "subscribe" || !query.get("hub.challenge") || expected.length !== provided.length || !timingSafeEqual(expected, provided)) return new Response("Forbidden", { status: 403 });
  await prisma.whatsappConnection.update({ where: { id: connection.id }, data: { verifiedAt: new Date(), activeAt: connection.activeAt ?? new Date() } });
  return new Response(query.get("hub.challenge"), { status: 200 });
}
export async function POST(request: Request, context: Context) {
  const connection = await resolve(context);
  if (!connection) return NextResponse.json({ error: "not found" }, { status: 404 });
  const raw = await request.text();
  if (!verifyWebhookSignature(raw, request.headers.get("x-hub-signature-256"), decryptSecret(connection.appSecretEncrypted))) return NextResponse.json({ error: "bad signature" }, { status: 401 });
  if (!connection.verifiedAt) return NextResponse.json({ error: "verify webhook first" }, { status: 409 });
  return processWhatsappWebhook(raw, connection);
}
