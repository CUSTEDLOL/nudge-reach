/**
 * CLI wrapper for the demo seed (the logic lives in lib/demo/seed.ts and is
 * shared with the in-app "Reset demo data" action).
 *
 * Run: npx esbuild scripts/seed-demo.ts --bundle --platform=node --format=cjs \
 *        --outfile=.next/seed-demo.cjs --external:@prisma/client && node .next/seed-demo.cjs
 */
import fs from "node:fs";
import path from "node:path";
import { seedDemoWorkspace } from "../lib/demo/seed";

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
    const counts = await seedDemoWorkspace(prisma);
    console.log("✅ demo seed complete");
    console.table(counts);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("❌", err instanceof Error ? err.message : err);
  process.exit(1);
});
