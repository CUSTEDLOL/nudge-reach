/**
 * Founder CLI: npm run plan:set -- --org <id-or-owner-email-prefix> --plan <planId>
 * Assigns any plan to an org — the only way onto the contact-only Enterprise
 * tier (E0, docs/plans/2026-09-04-enterprise-track.md). Prints before → after.
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PLANS } from "@/modules/billing/plans";

const PROJECT_ROOT = process.env.PROJECT_ROOT ?? process.cwd();
for (const file of [".env.local", ".env"]) {
  const p = path.join(PROJECT_ROOT, file);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const orgArg = arg("org");
  const planArg = arg("plan");
  const validIds = PLANS.map((p) => p.id);

  if (!orgArg || !planArg) {
    console.log("Usage: npm run plan:set -- --org <id-or-owner-email-prefix> --plan <planId>");
    console.log(`Plans: ${validIds.join(" | ")}`);
    process.exit(1);
  }
  if (!validIds.includes(planArg as (typeof validIds)[number])) {
    console.error(`Unknown plan "${planArg}". Valid: ${validIds.join(", ")}`);
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    // Exact org id first; else owner-email prefix (the demo/dev convenience).
    let org = await prisma.org.findUnique({
      where: { id: orgArg },
      select: { id: true, name: true, plan: true },
    });
    if (!org) {
      const membership = await prisma.membership.findFirst({
        where: { role: "OWNER", email: { startsWith: orgArg } },
        select: { org: { select: { id: true, name: true, plan: true } } },
      });
      org = membership?.org ?? null;
    }
    if (!org) {
      console.error(`No org found for "${orgArg}" (tried org id, then owner-email prefix).`);
      process.exit(1);
    }

    if (org.plan === planArg) {
      console.log(`${org.name} (${org.id}) is already on "${org.plan}" — nothing to do.`);
      return;
    }
    await prisma.org.update({ where: { id: org.id }, data: { plan: planArg } });
    console.log(`${org.name} (${org.id}): ${org.plan} → ${planArg}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
