/**
 * Phase 2 live verification — runs the REAL lib/campaign code path
 * (model-router → Haiku vision → defensive parse → repairs) with an
 * actual product photo, then writes the campaign to the DB like the
 * server action does and checks the page renders it.
 *
 * Bundled with esbuild (resolves the @/ alias), run with node.
 */
import fs from "node:fs";
import path from "node:path";

// Load .env.local BEFORE importing modules that validate env at load time.
const PROJECT_ROOT =
  process.env.PROJECT_ROOT ?? "/Users/visheshjain/Desktop/NUDGE/WhatsAppCRM";
for (const line of fs
  .readFileSync(path.join(PROJECT_ROOT, ".env.local"), "utf8")
  .split("\n")) {
  const m = line.match(/^([A-Z_]+)="?([^"]*)"?$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

async function main() {
  const { generateCampaignContent } = await import("@/lib/campaign/generate");

  const imagePath = process.argv[2] ?? "/tmp/test-product.jpg";
  const image = {
    data: fs.readFileSync(imagePath).toString("base64"),
    mediaType: "image/jpeg" as const,
  };

  console.log("→ generating campaign from photo (vision path)…");
  const content = await generateCampaignContent({
    description: "Cotton summer kurtas, new stock, 20% off this week",
    image,
  });

  console.log(JSON.stringify(content, null, 2));

  // Guardrail assertions
  const bodyVars = content.body.match(/\{\{1\}\}/g) ?? [];
  if (bodyVars.length !== 1) throw new Error("body must contain {{1}} exactly once");
  if (!/stop/i.test(content.footer)) throw new Error("footer must contain opt-out");
  if (content.header.length > 60) throw new Error("header too long");
  console.log("✅ guardrails hold: one {{1}}, opt-out footer, header ≤60");

  // Persist like the server action does, against the test user's org
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const org = await prisma.org.findFirstOrThrow();
  const product = await prisma.product.create({
    data: { orgId: org.id, name: content.productName, photoUrl: null },
  });
  const campaign = await prisma.campaign.create({
    data: {
      orgId: org.id,
      productId: product.id,
      name: content.productName,
      status: "DRAFT",
      content,
    },
  });
  console.log(`✅ campaign persisted: ${campaign.id}`);
  await prisma.$disconnect();
  console.log(`CAMPAIGN_ID=${campaign.id}`);
}

main().catch((err) => {
  console.error("❌", err instanceof Error ? err.message : err);
  process.exit(1);
});
