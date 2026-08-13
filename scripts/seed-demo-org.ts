/**
 * Provision (or reset) the shared guest-demo workspace that GET /demo
 * attaches anonymous visitors to. Idempotent — safe to re-run to restore
 * the demo after judges/testers have played with it.
 *
 * Run: npx esbuild scripts/seed-demo-org.ts --bundle --platform=node --format=cjs \
 *        --outfile=.next/seed-demo-org.cjs --external:@prisma/client && \
 *      SKIP_ENV_VALIDATION=1 node .next/seed-demo-org.cjs
 */
import fs from "node:fs";
import path from "node:path";
import { seedDemoWorkspace } from "@/modules/demo/seed";

// Must match DEMO_ORG_OWNER in src/app/demo/route.ts.
const DEMO_ORG_OWNER = "nudge-demo-template";

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
        data: { ownerUserId: DEMO_ORG_OWNER, name: "Kanchan Silks (Demo)" },
      });
    }
    const counts = await seedDemoWorkspace(prisma, org.id);
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
