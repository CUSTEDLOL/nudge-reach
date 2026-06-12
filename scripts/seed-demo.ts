/**
 * Demo retailer seed (Phase 5): a sample product, an opted-in audience and a
 * ready-to-submit DRAFT campaign, so the app demos instantly on first sign-in.
 * Deterministic — no AI call. Safe to re-run.
 *
 * Run: npx esbuild scripts/seed-demo.ts --bundle --platform=node --format=cjs \
 *        --outfile=.next/seed-demo.cjs --external:@prisma/client && node .next/seed-demo.cjs
 */
import fs from "node:fs";
import path from "node:path";

const PROJECT_ROOT =
  process.env.PROJECT_ROOT ?? "/Users/visheshjain/Desktop/NUDGE/WhatsAppCRM";
for (const line of fs
  .readFileSync(path.join(PROJECT_ROOT, ".env.local"), "utf8")
  .split("\n")) {
  const m = line.match(/^([A-Z_]+)="?([^"]*)"?$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const DEMO_CONTACTS: Array<[string, string]> = [
  ["Priya Sharma", "+919810000101"],
  ["Rahul Verma", "+919810000102"],
  ["Meera Iyer", "+919810000103"],
  ["Vikram Singh", "+919810000104"],
  ["Sneha Patel", "+919810000105"],
];

const DEMO_CAMPAIGN_CONTENT = {
  productName: "Banarasi Silk Dupatta",
  campaignAngle:
    "Festive-season exclusivity: handwoven pieces in limited stock.",
  header: "Handwoven Banarasi has arrived ✨",
  body: "Hi {{1}}, our new Banarasi silk dupattas just came in — handwoven, rich zari work, and only 20 pieces this season. Drop by this week and take 15% off your pick. Don't miss the festive colours!",
  footer: "Reply STOP to unsubscribe",
  buttons: [
    { type: "QUICK_REPLY", text: "Show me colours" },
    { type: "QUICK_REPLY", text: "Reserve one" },
  ],
  sampleName: "Priya",
  imageTreatment:
    "Drape the dupatta over a warm wooden surface in soft daylight so the zari catches the light.",
  notes: "Festive weekends convert best — send Thursday evening.",
};

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  const org = await prisma.org.findFirstOrThrow();

  const contactIds: string[] = [];
  for (const [name, phone] of DEMO_CONTACTS) {
    const contact = await prisma.contact.upsert({
      where: { orgId_phoneE164: { orgId: org.id, phoneE164: phone } },
      create: {
        orgId: org.id,
        name,
        phoneE164: phone,
        optedIn: true,
        optInSource: "in_store",
      },
      update: {},
    });
    contactIds.push(contact.id);
  }

  let audience = await prisma.audience.findFirst({
    where: { orgId: org.id, name: "Regular customers (demo)" },
  });
  if (!audience) {
    audience = await prisma.audience.create({
      data: {
        orgId: org.id,
        name: "Regular customers (demo)",
        contacts: { create: contactIds.map((contactId) => ({ contactId })) },
      },
    });
  }

  const existing = await prisma.campaign.findFirst({
    where: { orgId: org.id, name: DEMO_CAMPAIGN_CONTENT.productName },
  });
  if (!existing) {
    const product = await prisma.product.create({
      data: {
        orgId: org.id,
        name: DEMO_CAMPAIGN_CONTENT.productName,
        photoUrl: null,
        attributes: { description: "Handwoven Banarasi silk dupatta, festive stock" },
      },
    });
    await prisma.campaign.create({
      data: {
        orgId: org.id,
        productId: product.id,
        name: DEMO_CAMPAIGN_CONTENT.productName,
        status: "DRAFT",
        content: DEMO_CAMPAIGN_CONTENT,
      },
    });
  }

  console.log("✅ demo seed complete: 5 opted-in contacts, demo audience, draft campaign");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("❌", err instanceof Error ? err.message : err);
  process.exit(1);
});
