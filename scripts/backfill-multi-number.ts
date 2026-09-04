/**
 * E4 backfill (idempotent): npm run backfill:multi-number
 *  - every org's existing single WhatsApp account becomes its default
 *  - conversations/campaigns without a number point at their org's default
 * Safe to re-run; touches only rows that need it.
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const PROJECT_ROOT = process.env.PROJECT_ROOT ?? process.cwd();
for (const file of [".env.local", ".env"]) {
  const p = path.join(PROJECT_ROOT, file);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

async function main() {
  const prisma = new PrismaClient();
  try {
    // 1) One default per org: the oldest account of any org with no default.
    const accounts = await prisma.whatsappAccount.findMany({
      orderBy: { createdAt: "asc" },
    });
    const byOrg = new Map<string, typeof accounts>();
    for (const a of accounts) {
      (byOrg.get(a.orgId) ?? byOrg.set(a.orgId, []).get(a.orgId)!).push(a);
    }
    let defaulted = 0;
    for (const [, orgAccounts] of byOrg) {
      if (orgAccounts.some((a) => a.isDefault)) continue;
      await prisma.whatsappAccount.update({
        where: { id: orgAccounts[0].id },
        data: { isDefault: true },
      });
      defaulted++;
    }

    // 2) Point number-less conversations/campaigns at their org's default.
    let convos = 0;
    let campaigns = 0;
    for (const [orgId, orgAccounts] of byOrg) {
      const def = orgAccounts.find((a) => a.isDefault) ?? orgAccounts[0];
      convos += (
        await prisma.conversation.updateMany({
          where: { orgId, whatsappAccountId: null, channel: "whatsapp" },
          data: { whatsappAccountId: def.id },
        })
      ).count;
      campaigns += (
        await prisma.campaign.updateMany({
          where: { orgId, whatsappAccountId: null },
          data: { whatsappAccountId: def.id },
        })
      ).count;
    }
    console.log(
      `Backfill done: ${defaulted} org default(s) set, ${convos} conversation(s) and ${campaigns} campaign(s) pointed at defaults.`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
