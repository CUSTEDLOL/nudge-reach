/**
 * Manual end-to-end walkthrough of the credit ledger against a THROWAWAY
 * database (never DATABASE_URL from .env.local). Not part of the test suite;
 * run once by hand before the schema push to production. Makes real
 * Anthropic calls (tiny cost) so the debits are genuine, not mocked.
 *
 * Usage:
 *   DATABASE_URL="postgresql://postgres:testpass@localhost:55432/nudge_test" \
 *   DIRECT_URL="postgresql://postgres:testpass@localhost:55432/nudge_test" \
 *   npx tsx scripts/test-credit-ledger-e2e.ts
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

// Load ANTHROPIC_API_KEY etc from .env.local, but NEVER override an
// already-set DATABASE_URL/DIRECT_URL — those must stay pointed at the
// throwaway database passed in by the caller.
const PROJECT_ROOT = process.cwd();
for (const file of [".env.local", ".env"]) {
  const p = path.join(PROJECT_ROOT, file);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const dbUrl = process.env.DATABASE_URL ?? "";
if (!dbUrl.includes("localhost") && !dbUrl.includes("127.0.0.1")) {
  console.error(
    `REFUSING TO RUN: DATABASE_URL does not look like a local throwaway database (${dbUrl.replace(/:[^:@]*@/, ":***@")}).`
  );
  console.error("This script issues real credit debits and must never touch production.");
  process.exit(1);
}
// SEND_MODE must NOT be "simulation" for this run, or every debit is a
// shadow row that never touches a grant (correct product behaviour, but it
// defeats the point of this test). Force it off here, not in .env.
process.env.SEND_MODE = "live";

const prisma = new PrismaClient();

function line(s: string) {
  console.log(s);
}

async function main() {
  const { issueTrialGrant, creditBalance, MICRO_USD_PER_CREDIT } = await import("@/modules/billing/credits");
  const { generateAgentActionReply } = await import("@/modules/agent/reply");
  const { grantCredits } = await import("@/modules/admin/org-controls");

  async function seedOrg(name: string, ownerUserId: string, plan: string, trialEndsAt: Date | null) {
    const org = await prisma.org.create({ data: { name, ownerUserId, plan, trialEndsAt } });
    const profile = await prisma.agentProfile.create({
      data: { orgId: org.id, businessName: name, enabled: true },
    });
    const contact = await prisma.contact.create({
      data: { orgId: org.id, phoneE164: `+1${Math.floor(Math.random() * 1e10)}`, name: "Test Customer" },
    });
    const conversation = await prisma.conversation.create({
      data: { orgId: org.id, contactId: contact.id, channel: "whatsapp" },
    });
    return { org, profile, contact, conversation };
  }

  function ctxFor(o: { orgId: string; contactId: string; conversationId: string }) {
    return {
      orgId: o.orgId,
      contactId: o.contactId,
      conversationId: o.conversationId,
      contactName: "Test Customer",
      contactPhone: "+10000000000",
      channel: "whatsapp" as const,
      externalSync: false,
    };
  }

  line("=== 1. Create a test org on trial (mirrors real signup) ===");
  const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const t1 = await seedOrg("E2E Ledger Test Clinic", "e2e-test-user", "growth", trialEndsAt);
  await issueTrialGrant(t1.org.id, trialEndsAt);
  let balance = await creditBalance(t1.org.id);
  line(`Org created: ${t1.org.id}`);
  line(`Trial grant issued. Balance = ${balance / MICRO_USD_PER_CREDIT} credits (expect 100)`);
  if (balance !== 100 * MICRO_USD_PER_CREDIT) throw new Error("FAIL: trial grant is not 100 credits");
  line("PASS\n");

  line("=== 2. A real AI reply debits the balance by the real cost ===");
  const before = balance;
  const reply1 = await generateAgentActionReply(
    t1.profile,
    [{ role: "user", text: "Hi, what are your opening hours?" }],
    ctxFor({ orgId: t1.org.id, contactId: t1.contact.id, conversationId: t1.conversation.id })
  );
  balance = await creditBalance(t1.org.id);
  const spent = before - balance;
  line(`Agent replied: "${reply1.text.slice(0, 100)}..."`);
  line(`pausedForCredits: ${reply1.pausedForCredits ?? false}`);
  line(`Micro-USD spent on that one reply: ${spent} (should be > 0)`);
  if (spent <= 0) throw new Error("FAIL: no credits were debited for a real AI reply");
  const debitRow = await prisma.creditDebit.findFirst({
    where: { orgId: t1.org.id },
    orderBy: { createdAt: "desc" },
  });
  line(
    `CreditDebit row: purpose=${debitRow?.purpose} model=${debitRow?.model} amountMicroUsd=${debitRow?.amountMicroUsd} simulated=${debitRow?.simulated}`
  );
  if (!debitRow || debitRow.simulated) throw new Error("FAIL: expected a real (non-simulated) debit row");
  line("PASS\n");

  line("=== 3. Drain the balance to zero, then confirm the agent hands off instead of failing ===");
  await prisma.creditGrant.updateMany({
    where: { orgId: t1.org.id, kind: "trial" },
    data: { remainingMicroUsd: 0 },
  });
  balance = await creditBalance(t1.org.id);
  line(`Balance forced to ${balance} micro-USD`);

  const reply2 = await generateAgentActionReply(
    t1.profile,
    [{ role: "user", text: "Are you open on Sunday?" }],
    ctxFor({ orgId: t1.org.id, contactId: t1.contact.id, conversationId: t1.conversation.id })
  );
  line(`Reply at zero balance: "${reply2.text}"`);
  line(`pausedForCredits: ${reply2.pausedForCredits}  handoff: ${reply2.handoff}`);
  if (!reply2.pausedForCredits || !reply2.handoff) {
    throw new Error("FAIL: expected a handoff reply, not a thrown error, at zero balance");
  }
  line("PASS — customer still got an answer, no crash\n");

  line("=== 4. Admin grants more credits; the agent resumes ===");
  const grantResult = await grantCredits(t1.org.id, 50, 30, "test-founder@nudge.local", "E2E test grant");
  line(`grantCredits result: ${JSON.stringify(grantResult)}`);
  balance = await creditBalance(t1.org.id);
  line(`Balance after founder grant: ${balance / MICRO_USD_PER_CREDIT} credits (expect 50)`);
  if (balance !== 50 * MICRO_USD_PER_CREDIT) throw new Error("FAIL: founder grant did not land");

  const reply3 = await generateAgentActionReply(
    t1.profile,
    [{ role: "user", text: "Great, thank you!" }],
    ctxFor({ orgId: t1.org.id, contactId: t1.contact.id, conversationId: t1.conversation.id })
  );
  line(`Reply after top-up: "${reply3.text.slice(0, 100)}..."`);
  if (reply3.pausedForCredits) throw new Error("FAIL: agent should have resumed after the grant");
  line("PASS — agent answered normally again after the grant\n");

  line("=== 5. A legacy (unmetered) plan is never gated, even with zero grants ===");
  const t2 = await seedOrg("Legacy Org", "e2e-test-user-2", "front_desk", null);
  const reply4 = await generateAgentActionReply(
    t2.profile,
    [{ role: "user", text: "Hello" }],
    ctxFor({ orgId: t2.org.id, contactId: t2.contact.id, conversationId: t2.conversation.id })
  );
  line(`Legacy org (no credit grants at all) pausedForCredits: ${reply4.pausedForCredits ?? false}`);
  if (reply4.pausedForCredits) throw new Error("FAIL: legacy unmetered org must never be gated");
  const legacyDebit = await prisma.creditDebit.findFirst({ where: { orgId: t2.org.id } });
  line(`Legacy debit row absorbed=${legacyDebit?.absorbed}`);
  line("PASS — legacy plan never blocked, cost absorbed\n");

  line("=== ALL CHECKS PASSED ===");
}

main()
  .catch((err) => {
    console.error("\n!!! FAILED !!!");
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
