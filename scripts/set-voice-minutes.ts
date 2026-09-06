/**
 * Founder CLI: npm run voice:minutes -- --org <id-or-owner-email-prefix> --minutes <n|plan>
 *
 * Sets a bespoke monthly call-minute allowance for one org, overriding the
 * plan's. `--minutes plan` clears the override and falls back to the plan.
 * When the allowance runs out the AI stops answering that number until the
 * next calendar month (or until you raise it here).
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { getPlan } from "@/modules/billing/plans";

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

const label = (n: number | null) => (n === null ? "unlimited" : `${n} min/month`);

async function main() {
  const orgArg = arg("org");
  const minutesArg = arg("minutes");
  if (!orgArg || !minutesArg) {
    console.log("Usage: npm run voice:minutes -- --org <id-or-owner-email-prefix> --minutes <n|plan>");
    console.log('  --minutes 100    a package with 100 call minutes a month');
    console.log('  --minutes plan   clear the override, use the plan allowance');
    process.exit(1);
  }
  const clearing = minutesArg === "plan";
  const minutes = clearing ? null : Number(minutesArg);
  if (!clearing && (!Number.isInteger(minutes) || (minutes as number) < 0)) {
    console.error(`--minutes must be a whole number of minutes, or "plan". Got "${minutesArg}".`);
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    let org = await prisma.org.findUnique({
      where: { id: orgArg },
      select: { id: true, name: true, plan: true, voiceMinutesOverride: true },
    });
    if (!org) {
      const membership = await prisma.membership.findFirst({
        where: { role: "OWNER", email: { startsWith: orgArg } },
        select: { org: { select: { id: true, name: true, plan: true, voiceMinutesOverride: true } } },
      });
      org = membership?.org ?? null;
    }
    if (!org) {
      console.error(`No org found for "${orgArg}" (tried org id, then owner-email prefix).`);
      process.exit(1);
    }

    const planMinutes = getPlan(org.plan).limits.voiceMinutesPerMonth;
    const before = org.voiceMinutesOverride ?? planMinutes;
    await prisma.org.update({ where: { id: org.id }, data: { voiceMinutesOverride: minutes } });
    const after = minutes ?? planMinutes;
    console.log(`${org.name} (${org.id}) on "${org.plan}"`);
    console.log(`  call minutes: ${label(before)} → ${label(after)}${clearing ? " (from the plan)" : ""}`);
    if (!getPlan(org.plan).limits.voiceAgent) {
      console.log("  note: this plan has no voice front desk — set the plan too (npm run plan:set).");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
