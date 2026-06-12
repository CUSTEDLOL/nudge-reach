/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Phase 1 verification (dev-only). Signs in as the test user, exercises
 * contact/audience CRUD at the data layer, and checks the /contacts page
 * renders the data. Run: APP_URL=http://localhost:3001 node scripts/verify-phase1.js
 */
const { createClient } = require("@supabase/supabase-js");
const { PrismaClient } = require("@prisma/client");
const fs = require("node:fs");
const path = require("node:path");

for (const line of fs
  .readFileSync(path.join(__dirname, "..", ".env.local"), "utf8")
  .split("\n")) {
  const m = line.match(/^([A-Z_]+)="?([^"]*)"?$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const EMAIL = "visheshjain1705+nudgetest@gmail.com";
const PASSWORD = "NudgeTest!2026";
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const PROJECT_REF = new global.URL(URL).hostname.split(".")[0];
const BASE = process.env.APP_URL || "http://localhost:3000";

function sessionCookies(session) {
  const value =
    "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  const name = `sb-${PROJECT_REF}-auth-token`;
  const MAX = 3180;
  if (value.length <= MAX) return [`${name}=${value}`];
  const chunks = [];
  for (let i = 0; i * MAX < value.length; i++) {
    chunks.push(`${name}.${i}=${value.slice(i * MAX, (i + 1) * MAX)}`);
  }
  return chunks;
}

async function main() {
  const supabase = createClient(URL, KEY);
  const { data, error } = await supabase.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });
  if (error) throw new Error(error.message);

  const prisma = new PrismaClient();
  const org = await prisma.org.findUniqueOrThrow({
    where: { ownerUserId: data.user.id },
  });

  // CRUD: create (idempotent for re-runs), read, update, audience link
  const contact = await prisma.contact.upsert({
    where: {
      orgId_phoneE164: { orgId: org.id, phoneE164: "+919876543210" },
    },
    create: {
      orgId: org.id,
      name: "Priya Sharma (demo)",
      phoneE164: "+919876543210",
      optedIn: true,
      optInSource: "in_store",
    },
    update: { name: "Priya Sharma (demo)", optedIn: true, optedOutAt: null },
  });
  console.log("✅ contact created:", contact.id);

  await prisma.audience.deleteMany({
    where: { orgId: org.id, name: "Demo audience" },
  });
  const audience = await prisma.audience.create({
    data: {
      orgId: org.id,
      name: "Demo audience",
      contacts: { create: [{ contactId: contact.id }] },
    },
    include: { _count: { select: { contacts: true } } },
  });
  console.log(
    `✅ audience created: ${audience.id} (${audience._count.contacts} member)`
  );

  const res = await fetch(`${BASE}/contacts`, {
    headers: { cookie: sessionCookies(data.session).join("; ") },
  });
  const html = await res.text();
  const renders =
    res.status === 200 &&
    html.includes("Priya Sharma (demo)") &&
    html.includes("Demo audience");
  console.log(
    renders
      ? "✅ /contacts page renders the contact and audience"
      : `❌ /contacts page check failed (status=${res.status})`
  );

  await prisma.$disconnect();
  if (!renders) process.exit(1);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
