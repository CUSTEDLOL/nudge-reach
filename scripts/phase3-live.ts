/**
 * Phase 3 verification — drives the REAL approval flow in simulation:
 * submit → PENDING (valid payload row) → mock review window → APPROVED.
 * Bundle with esbuild, run with node (see phase2-live.ts).
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

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const { submitTemplateForApproval, refreshTemplateStatus } = await import(
    "@/modules/whatsapp/approval"
  );
  const prisma = new PrismaClient();

  const campaign = await prisma.campaign.findFirstOrThrow({
    orderBy: { createdAt: "desc" },
  });
  console.log(`→ submitting campaign ${campaign.id} (“${campaign.name}”)`);

  const template = await submitTemplateForApproval(campaign.id, campaign.orgId);
  console.log(`✅ template created: ${template.name} (${template.metaStatus})`);

  const components = template.componentsJson as Array<{ type: string }>;
  const types = components.map((c) => c.type);
  if (!types.includes("BODY") || !types.includes("FOOTER")) {
    throw new Error(`payload missing components: ${types.join(",")}`);
  }
  console.log(`✅ payload components: ${types.join(", ")}`);

  const pending = await prisma.campaign.findUniqueOrThrow({
    where: { id: campaign.id },
  });
  if (pending.status !== "TEMPLATE_PENDING") {
    throw new Error(`expected TEMPLATE_PENDING, got ${pending.status}`);
  }
  console.log("✅ campaign status: TEMPLATE_PENDING");

  console.log("→ waiting out the simulated review window (11s)…");
  await new Promise((resolve) => setTimeout(resolve, 11_000));

  const refreshed = await refreshTemplateStatus(campaign.id, campaign.orgId);
  if (refreshed?.metaStatus !== "APPROVED") {
    throw new Error(`expected APPROVED, got ${refreshed?.metaStatus}`);
  }
  const approved = await prisma.campaign.findUniqueOrThrow({
    where: { id: campaign.id },
  });
  if (approved.status !== "TEMPLATE_APPROVED") {
    throw new Error(`expected TEMPLATE_APPROVED, got ${approved.status}`);
  }
  console.log("✅ template APPROVED, campaign TEMPLATE_APPROVED");
  await prisma.$disconnect();
  console.log(`CAMPAIGN_ID=${campaign.id}`);
}

main().catch((err) => {
  console.error("❌", err instanceof Error ? err.message : err);
  process.exit(1);
});
