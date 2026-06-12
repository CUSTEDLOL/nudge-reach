/**
 * Phase 4 verification — runs a campaign through the REAL send pipeline in
 * simulation: audience setup (incl. a non-consenting contact that must be
 * skipped) → enqueue → process → simulated delivery lifecycle → stats.
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

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const { enqueueCampaign, processQueue, applySimulatedProgress, campaignStats } =
    await import("@/lib/send/queue");
  const prisma = new PrismaClient();

  const campaign = await prisma.campaign.findFirstOrThrow({
    where: { status: { in: ["TEMPLATE_APPROVED", "SENDING", "SENT"] } },
    orderBy: { createdAt: "desc" },
  });
  const org = await prisma.org.findUniqueOrThrow({
    where: { id: campaign.orgId },
  });

  // Reset campaign to approved (idempotent re-runs) and clear old messages.
  await prisma.message.deleteMany({ where: { campaignId: campaign.id } });
  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { status: "TEMPLATE_APPROVED" },
  });

  // Build a 10-person audience: 9 opted in, 1 NOT opted in (must be skipped).
  const names = [
    ["Asha", "+919810000001", true],
    ["Rahul", "+919810000002", true],
    ["Meera", "+919810000003", true],
    ["Vikram", "+919810000004", true],
    ["Sneha", "+919810000005", true],
    ["Arjun", "+919810000006", true],
    ["Divya", "+919810000007", true],
    ["Kabir", "+919810000008", true],
    ["Nidhi", "+919810000009", true],
    ["NoConsent Nate", "+919810000010", false],
  ] as const;

  const contactIds: string[] = [];
  for (const [name, phone, optedIn] of names) {
    const contact = await prisma.contact.upsert({
      where: { orgId_phoneE164: { orgId: org.id, phoneE164: phone } },
      create: {
        orgId: org.id,
        name,
        phoneE164: phone,
        optedIn,
        optInSource: "verification",
      },
      update: { optedIn, optedOutAt: null },
    });
    contactIds.push(contact.id);
  }

  await prisma.audience.deleteMany({
    where: { orgId: org.id, name: "Phase 4 test audience" },
  });
  const audience = await prisma.audience.create({
    data: {
      orgId: org.id,
      name: "Phase 4 test audience",
      contacts: { create: contactIds.map((contactId) => ({ contactId })) },
    },
  });

  console.log(`→ running campaign ${campaign.id} to 10-person audience (9 opted in)`);
  const { queued, skippedNoConsent } = await enqueueCampaign(
    campaign.id,
    audience.id,
    org.id
  );
  if (queued !== 9 || skippedNoConsent !== 1) {
    throw new Error(`consent gate failed: queued=${queued} skipped=${skippedNoConsent}`);
  }
  console.log("✅ consent gate: 9 queued, 1 skipped (no opt-in)");

  const sent = await processQueue(campaign.id);
  console.log(`✅ processed batch: ${sent} sends via simulation driver`);

  console.log("→ letting the simulated delivery lifecycle play out (~25s)…");
  for (let i = 0; i < 5; i++) {
    await wait(5500);
    await applySimulatedProgress(campaign.id);
    const stats = await campaignStats(campaign.id);
    console.log(
      `   t+${(i + 1) * 5.5}s  sent=${stats.sent} delivered=${stats.delivered} read=${stats.read} clicked=${stats.clicked} failed=${stats.failed} cost=₹${(stats.actualCostMinor / 100).toFixed(2)}`
    );
  }

  const final = await campaignStats(campaign.id);
  const done = await prisma.campaign.findUniqueOrThrow({
    where: { id: campaign.id },
  });
  if (final.total !== 9) throw new Error("expected 9 messages");
  if (final.delivered === 0) throw new Error("nothing delivered");
  if (final.read === 0) throw new Error("nothing read");
  if (final.actualCostMinor === 0) throw new Error("no cost accrued");
  if (done.status !== "SENT") throw new Error(`campaign status ${done.status}`);
  console.log("✅ dashboard data complete: delivered/read/cost populated, campaign SENT");

  // One message id for the webhook test
  const msg = await prisma.message.findFirstOrThrow({
    where: { campaignId: campaign.id, metaMessageId: { not: null } },
  });
  console.log(`MESSAGE_META_ID=${msg.metaMessageId}`);
  console.log(`CAMPAIGN_ID=${campaign.id}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("❌", err instanceof Error ? err.message : err);
  process.exit(1);
});
