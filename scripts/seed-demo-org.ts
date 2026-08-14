/**
 * Provision (or reset) the shared guest-demo workspace that GET /demo
 * attaches anonymous visitors to. Wipes CRM data AND the front-desk state
 * (agent profile, knowledge, bookings, owner questions) so a re-run fully
 * restores the canonical "The Spice Garden" demo, then re-seeds. Keeps
 * memberships, so existing guest sessions stay valid.
 *
 * Run: npx esbuild scripts/seed-demo-org.ts --bundle --platform=node --format=cjs \
 *        --outfile=.next/seed-demo-org.cjs --external:@prisma/client && \
 *      SKIP_ENV_VALIDATION=1 node .next/seed-demo-org.cjs
 */
import fs from "node:fs";
import path from "node:path";
import { resetDemoWorkspace } from "@/modules/demo/reset";

// Must match DEMO_ORG_OWNER in src/app/demo/route.ts.
const DEMO_ORG_OWNER = "nudge-demo-template";
const DEMO_ORG_NAME = "The Spice Garden (Demo)";

const PROJECT_ROOT = process.env.PROJECT_ROOT ?? process.cwd();
const envFile = path.join(PROJECT_ROOT, ".env.local");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)="?([^"]*)"?$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    let org = await prisma.org.findUnique({
      where: { ownerUserId: DEMO_ORG_OWNER },
    });
    if (!org) {
      org = await prisma.org.create({
        data: { ownerUserId: DEMO_ORG_OWNER, name: DEMO_ORG_NAME },
      });
    }
    await prisma.org.update({
      where: { id: org.id },
      data: { name: DEMO_ORG_NAME, vertical: "restaurant" },
    });

    // Front-desk state the CRM reset deliberately keeps — wipe it here so the
    // canonical theme is re-created from scratch on every provision run.
    await prisma.$transaction([
      prisma.ownerQuestion.deleteMany({ where: { orgId: org.id } }),
      prisma.knowledgeEntry.deleteMany({ where: { orgId: org.id } }),
      prisma.bookingRequest.deleteMany({ where: { orgId: org.id } }),
      prisma.agentProfile.deleteMany({ where: { orgId: org.id } }),
    ]);

    const counts = await resetDemoWorkspace(prisma, org.id);
    console.log("✅ demo org ready:", org.id);
    console.table(counts);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("❌", err instanceof Error ? err.message : err);
  process.exit(1);
});
