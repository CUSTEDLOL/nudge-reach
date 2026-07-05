/**
 * Phase 7 live verification — runs the REAL agent path (handleInboundMessage →
 * Haiku → reply) in simulation. Proves: grounded answer, off-topic decline
 * (Meta-policy compliance), and STOP opt-out.
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
  const { handleInboundMessage } = await import("@/modules/agent/inbound");
  const prisma = new PrismaClient();
  const org = await prisma.org.findFirstOrThrow();

  // Configure a restaurant agent with concrete knowledge.
  await prisma.agentProfile.upsert({
    where: { orgId: org.id },
    create: {
      orgId: org.id,
      enabled: true,
      vertical: "restaurant",
      businessName: "Spice Garden",
      businessInfo:
        "Open Tue–Sun 12pm–11pm, closed Mondays. Address: 14 MG Road, Bengaluru. " +
        "Veg & non-veg North Indian. Popular: Paneer Tikka ₹280, Butter Chicken ₹360, " +
        "Garlic Naan ₹60. Reservations for 6+ only, confirmed by call. Takeaway + delivery on Swiggy/Zomato.",
      tone: "Warm, friendly, concise",
      doNots: "",
    },
    update: { enabled: true, businessName: "Spice Garden" },
  });

  const phone = "+919810009001";
  // fresh thread each run
  const existing = await prisma.contact.findUnique({
    where: { orgId_phoneE164: { orgId: org.id, phoneE164: phone } },
  });
  if (existing) {
    await prisma.conversation.deleteMany({ where: { contactId: existing.id } });
    await prisma.contact.update({ where: { id: existing.id }, data: { optedIn: false, optedOutAt: null } });
  }

  console.log("→ Q1 (grounded): 'Are you open on Mondays and how much is the paneer tikka?'");
  const r1 = await handleInboundMessage(org.id, phone, "Are you open on Mondays and how much is the paneer tikka?");
  console.log("   reply:", r1.reply);
  const grounded = /monday/i.test(r1.reply ?? "") && /280/.test(r1.reply ?? "");
  console.log(grounded ? "   ✅ grounded in the business info (Mondays + ₹280)" : "   ⚠️ check grounding");

  console.log("\n→ Q2 (off-topic, must decline): 'What is the capital of France?'");
  const r2 = await handleInboundMessage(org.id, phone, "What is the capital of France?");
  console.log("   reply:", r2.reply);
  const declined = !/paris/i.test(r2.reply ?? "");
  console.log(declined ? "   ✅ did NOT answer off-topic (policy-compliant scope)" : "   ❌ answered off-topic — guardrail failed");

  console.log("\n→ Q3 (STOP): opt-out");
  const r3 = await handleInboundMessage(org.id, phone, "STOP");
  const contact = await prisma.contact.findUniqueOrThrow({ where: { orgId_phoneE164: { orgId: org.id, phoneE164: phone } } });
  console.log(r3.optedOut && contact.optedOutAt ? "   ✅ opted out, no reply" : "   ❌ STOP not handled");

  await prisma.$disconnect();
  if (!grounded || !declined || !r3.optedOut) process.exit(1);
  console.log("\n✅ Phase 7 agent verified end to end.");
}

main().catch((e) => { console.error("❌", e instanceof Error ? e.message : e); process.exit(1); });
