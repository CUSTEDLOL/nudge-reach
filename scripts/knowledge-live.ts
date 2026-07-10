/**
 * Knowledge-memory live verification (simulation mode, real code paths):
 *  1. Customer asks something the KB doesn't cover → agent queues an
 *     OwnerQuestion and tells them it's checking with the team.
 *  2. Owner answers → distilled facts land in KnowledgeEntry, and the waiting
 *     customer gets an automatic follow-up (24h window is open).
 *  3. The customer asks again → the agent answers from memory; no new
 *     owner question is created.
 * Cleans up everything it created. Run:
 *   npx esbuild scripts/knowledge-live.ts --bundle --platform=node --format=cjs \
 *     --outfile=.next/knowledge-live.cjs --external:@prisma/client && node .next/knowledge-live.cjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
for (const file of [".env.local", ".env"]) {
  const p = path.join(ROOT, file);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)="?([^"]*)"?$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
process.env.SEND_MODE = "simulation"; // never send real messages from a script

const TEST_PHONE = "+919899000111";
// In-scope for the Spice Garden test profile but NOT in its knowledge — the
// exact case ask_owner exists for. (Off-topic questions get refused by the
// scope guardrail instead, correctly.)
const QUESTION = "Do you serve chicken kebabs?";

function ok(label: string, pass: boolean, detail = "") {
  console.log(`${pass ? "✅" : "❌"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!pass) process.exitCode = 1;
}

async function main() {
  const { prisma } = await import("@/lib/db");
  const { handleInboundMessage } = await import("@/modules/agent/inbound");
  const { answerOwnerQuestion } = await import("@/modules/knowledge/questions");
  const { questionKey } = await import("@/modules/knowledge/normalize");

  const org = await prisma.org.findFirstOrThrow();
  const membership = await prisma.membership.findFirstOrThrow({
    where: { orgId: org.id, role: "OWNER" },
  });

  // Same test profile scripts/agent-tools-live.ts uses — a restaurant whose
  // knowledge does NOT mention kebabs.
  await prisma.agentProfile.upsert({
    where: { orgId: org.id },
    create: {
      orgId: org.id,
      enabled: true,
      vertical: "restaurant",
      businessName: "Spice Garden",
      businessInfo:
        "Open every day 12pm–11pm. 14 MG Road, Bengaluru. Paneer Tikka ₹280, Butter Chicken ₹360. We take reservations for any party size; the team confirms the slot.",
      tone: "Warm, concise",
      doNots: "",
    },
    update: { enabled: true },
  });
  const ctx = {
    org,
    membership,
    role: "OWNER" as const,
    userId: membership.userId,
    email: membership.email,
  };
  const key = questionKey(QUESTION);

  // Fresh slate for this scenario.
  await prisma.ownerQuestion.deleteMany({ where: { orgId: org.id, questionKey: key } });

  // 1 — unknown question
  const r1 = await handleInboundMessage(org.id, TEST_PHONE, QUESTION);
  console.log(`agent: ${r1.reply}`);
  const q = await prisma.ownerQuestion.findFirst({
    where: { orgId: org.id, questionKey: key, status: "pending" },
  });
  ok("OwnerQuestion queued", Boolean(q), q?.question);
  ok("agent used ask_owner", (r1.actions ?? []).includes("ask_owner"), String(r1.actions));

  // 2 — owner answers
  if (q) {
    const a = await answerOwnerQuestion(ctx, q.id, "Yes, chicken kebabs are on the menu but only on weekends — ₹320 a plate.");
    ok("facts distilled", a.facts >= 1, `${a.facts} fact(s)`);
    ok("waiting customer followed up", a.followUpsSent >= 1, `${a.followUpsSent} follow-up(s)`);
    const convo = await prisma.conversation.findFirst({
      where: { orgId: org.id, contact: { phoneE164: TEST_PHONE } },
      select: { id: true },
    });
    const followUp = convo
      ? await prisma.conversationMessage.findFirst({
          where: { conversationId: convo.id, direction: "outbound", body: { contains: "checked with the team" } },
        })
      : null;
    ok("follow-up message threaded", Boolean(followUp), followUp?.body?.slice(0, 90));
  }

  // 3 — asks again → answered from memory (today is a weekday, so the
  // weekends-only condition should surface), no new question
  const r2 = await handleInboundMessage(org.id, TEST_PHONE, "Great — can I order chicken kebabs today?");
  console.log(`agent: ${r2.reply}`);
  const pendingAfter = await prisma.ownerQuestion.count({
    where: { orgId: org.id, questionKey: key, status: "pending" },
  });
  ok("no new pending question", pendingAfter === 0);
  ok("agent answered (no checking-with-team stall)", Boolean(r2.reply) && !/checking with (the )?team/i.test(r2.reply ?? ""), r2.reply?.slice(0, 90));

  // Cleanup everything this script created.
  const contact = await prisma.contact.findUnique({
    where: { orgId_phoneE164: { orgId: org.id, phoneE164: TEST_PHONE } },
  });
  if (contact) {
    await prisma.conversation.deleteMany({ where: { orgId: org.id, contactId: contact.id } });
    await prisma.note.deleteMany({ where: { orgId: org.id, contactId: contact.id } });
    await prisma.contact.delete({ where: { id: contact.id } });
  }
  const answered = await prisma.ownerQuestion.findFirst({
    where: { orgId: org.id, questionKey: key },
  });
  if (answered) {
    await prisma.knowledgeEntry.deleteMany({ where: { orgId: org.id, id: { in: answered.entryIds } } });
    await prisma.ownerQuestion.delete({ where: { id: answered.id } });
  }
  console.log("🧹 cleaned up test contact, conversation, question and learned facts");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
