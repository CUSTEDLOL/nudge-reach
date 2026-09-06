/**
 * CRM sync live verification (simulation): connects the simulated CRM for the
 * first org, drives one real inbound through the agent (which creates the
 * contact + a booking via the real tool loop), runs the sync tick, asserts
 * every job is done with a sim_ external id, then cleans up.
 *
 *   npx esbuild scripts/crm-live.ts --bundle --platform=node --format=cjs \
 *     --outfile=.next/crm-live.cjs --external:@prisma/client --external:@anthropic-ai/sdk && \
 *   PROJECT_ROOT=$PWD node .next/crm-live.cjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.env.PROJECT_ROOT ?? process.cwd();
for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)="?([^"]*)"?$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
process.env.SEND_MODE = "simulation";

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const { saveConnection } = await import("@/modules/crm/connections");
  const { tickCrmSync } = await import("@/modules/crm/sync");
  const { handleInboundMessage } = await import("@/modules/agent/inbound");
  const prisma = new PrismaClient();
  const org = await prisma.org.findFirstOrThrow();
  const phone = "+919810009777";

  await saveConnection(
    org.id,
    "sim",
    { accessToken: "sim", refreshToken: "sim", expiresInSecs: 3600, apiDomain: "", accountsServer: "", accountLabel: "Simulated CRM" },
    true
  );
  await prisma.contact.deleteMany({ where: { orgId: org.id, phoneE164: phone } });

  await handleInboundMessage(org.id, phone, "I'd like to book a table for 4 tomorrow at 8pm, under Rahul. Yes please book it.");

  // A stage change made anywhere in the product (inbox, contacts table, public
  // API) must reach the CRM too — it travels via the ContactEvent history.
  const { recordContactEvent } = await import("@/modules/contacts/events");
  const contact = await prisma.contact.findFirst({ where: { orgId: org.id, phoneE164: phone } });
  if (contact) {
    await prisma.contact.update({ where: { id: contact.id }, data: { leadStage: "WON" } });
    recordContactEvent(org.id, "lead_stage_changed", { contactId: contact.id, props: { to: "WON", source: "script" } });
    await new Promise((r) => setTimeout(r, 400)); // fire-and-forget write
  }
  // one job per connection lane per tick — drain a few times
  const ticks = [];
  for (let i = 0; i < 4; i++) ticks.push(await tickCrmSync());
  const jobs = await prisma.crmSyncJob.findMany({ where: { orgId: org.id, provider: "sim" }, orderBy: { createdAt: "asc" } });
  console.log("ticks:", JSON.stringify(ticks));
  console.log("jobs:", jobs.map((j) => `${j.event}=${j.status}:${j.externalId}`).join(", "));
  const sawStageChange = jobs.some((j) => j.event === "lead.stage_changed");
  const ok =
    jobs.length >= 2 &&
    sawStageChange &&
    jobs.every((j) => j.status === "done" && j.externalId?.startsWith("sim_"));
  if (!sawStageChange) console.log("   ✗ no lead.stage_changed job — the ContactEvent bridge did not fire");
  console.log(ok ? "✅ CRM sync verified in simulation" : "❌ CRM sync failed");

  await prisma.crmSyncJob.deleteMany({ where: { orgId: org.id, provider: "sim" } });
  await prisma.crmConnection.deleteMany({ where: { orgId: org.id, provider: "sim" } });
  await prisma.contact.deleteMany({ where: { orgId: org.id, phoneE164: phone } });
  await prisma.$disconnect();
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
