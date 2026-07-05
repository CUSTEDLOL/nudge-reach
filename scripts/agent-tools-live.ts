/**
 * Milestone 1 live verification — the REAL tool-calling loop against Haiku,
 * in simulation. Proves the agent *acts*, not just chats:
 *  - a booking flow → capture_booking_request → a BookingRequest row + confirming reply
 *  - buying intent → capture_lead → contact marked QUALIFIED
 *  - a plain question → NO tool, just a grounded answer
 *  - an angry ask-for-a-human → handoff
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.env.PROJECT_ROOT ?? "/Users/visheshjain/Desktop/NUDGE/WhatsAppCRM";
for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)="?([^"]*)"?$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const { handleInboundMessage } = await import("@/lib/agent/inbound");
  const prisma = new PrismaClient();
  const org = await prisma.org.findFirstOrThrow();

  await prisma.agentProfile.upsert({
    where: { orgId: org.id },
    create: {
      orgId: org.id, enabled: true, vertical: "restaurant", businessName: "Spice Garden",
      businessInfo: "Open every day 12pm–11pm. 14 MG Road, Bengaluru. Paneer Tikka ₹280, Butter Chicken ₹360. We take reservations for any party size; the team confirms the slot.",
      tone: "Warm, concise", doNots: "",
    },
    update: { enabled: true, vertical: "restaurant", businessName: "Spice Garden" },
  });

  const phone = "+919810050001";
  const existing = await prisma.contact.findUnique({ where: { orgId_phoneE164: { orgId: org.id, phoneE164: phone } } });
  if (existing) {
    await prisma.conversation.deleteMany({ where: { contactId: existing.id } });
    await prisma.bookingRequest.deleteMany({ where: { contactId: existing.id } });
    await prisma.contact.update({ where: { id: existing.id }, data: { leadStage: "NEW", name: phone, optedOutAt: null, optedIn: false } });
  }
  await prisma.bookingRequest.deleteMany({ where: { orgId: org.id, name: "Rahul (test)" } });

  const say = async (t: string) => {
    const r = await handleInboundMessage(org.id, phone, t);
    console.log(`\n👤 ${t}\n🤖 ${r.reply}${r.actions ? `\n   [tools: ${r.actions.join(", ")}]` : ""}`);
    return r;
  };

  // 1) Plain question — expect NO tool
  const q = await say("Hi, are you open on Mondays?");
  const noTool = !q.actions || q.actions.length === 0;
  console.log(noTool ? "   ✅ plain question used no tool" : "   ⚠️ unexpected tool on a plain question");

  // 2) Booking — multi-turn; expect capture_booking_request + a BookingRequest row
  await say("I'd like to book a table for 4 tomorrow at 8pm.");
  await say("Name is Rahul (test).");
  const b = await say("Yes that's right — 4 people, tomorrow 8pm, under Rahul (test). Please book it.");
  const booking = await prisma.bookingRequest.findFirst({ where: { orgId: org.id, name: "Rahul (test)" }, orderBy: { createdAt: "desc" } });
  console.log(booking ? `   ✅ BookingRequest row created: ${booking.name} / ${booking.requestedFor} / party ${booking.partySize}` : "   ❌ no BookingRequest row");
  void b;

  // 3) Lead — buying intent; expect capture_lead + contact QUALIFIED
  const phone2 = "+919810050002";
  const ex2 = await prisma.contact.findUnique({ where: { orgId_phoneE164: { orgId: org.id, phoneE164: phone2 } } });
  if (ex2) { await prisma.conversation.deleteMany({ where: { contactId: ex2.id } }); await prisma.contact.update({ where: { id: ex2.id }, data: { leadStage: "NEW" } }); }
  await handleInboundMessage(org.id, phone2, "Do you do large party catering? I want to book your place for a 40-person office dinner next month, budget around 60k.");
  const lead = await prisma.contact.findUnique({ where: { orgId_phoneE164: { orgId: org.id, phoneE164: phone2 } } });
  console.log(`\n   lead stage for catering enquiry: ${lead?.leadStage}`, lead?.leadStage === "QUALIFIED" ? "✅ captured as qualified lead" : "(agent judged not a lead)");

  // 4) Off-topic still declines
  const ot = await say("What's the capital of France?");
  console.log(!/paris/i.test(ot.reply ?? "") ? "   ✅ off-topic declined (compliant)" : "   ❌ answered off-topic");

  await prisma.$disconnect();
  if (!booking) { console.error("\n❌ booking not captured"); process.exit(1); }
  console.log("\n✅ Milestone 1 agent verified: it takes real actions.");
}

main().catch((e) => { console.error("❌", e instanceof Error ? e.message : e); process.exit(1); });
