/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Phase 0 verification helper (dev-only, run with `node`).
 * Usage:
 *   node scripts/verify-phase0.js signup   — create the test user
 *   node scripts/verify-phase0.js signin   — sign in, hit /dashboard with the
 *                                            session cookie, check the Org row
 */
const { createClient } = require("@supabase/supabase-js");
const fs = require("node:fs");
const path = require("node:path");

// Minimal .env.local loader (no dotenv dependency)
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

const supabase = createClient(URL, KEY);

function sessionCookies(session) {
  // Mirror @supabase/ssr cookie encoding: "base64-" prefix + base64url JSON,
  // chunked into sb-<ref>-auth-token(.N) pieces of <=3180 chars.
  const value =
    "base64-" +
    Buffer.from(JSON.stringify(session)).toString("base64url");
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
  const mode = process.argv[2];

  if (mode === "signup") {
    const { data, error } = await supabase.auth.signUp({
      email: EMAIL,
      password: PASSWORD,
    });
    if (error) throw new Error(`signUp failed: ${error.message}`);
    console.log(
      JSON.stringify({
        userId: data.user?.id,
        confirmed: Boolean(data.user?.email_confirmed_at),
        hasSession: Boolean(data.session),
      })
    );
    return;
  }

  if (mode === "signin") {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: EMAIL,
      password: PASSWORD,
    });
    if (error) throw new Error(`signIn failed: ${error.message}`);
    console.log("✅ signed in as", data.user.email, data.user.id);

    const cookies = sessionCookies(data.session);
    const base = process.env.APP_URL || "http://localhost:3000";
    const res = await fetch(`${base}/dashboard`, {
      headers: { cookie: cookies.join("; ") },
      redirect: "manual",
    });
    const html = await res.text();
    const greeted = res.status === 200 && html.includes("Hello,");
    console.log(
      greeted
        ? "✅ /dashboard rendered the signed-in greeting"
        : `❌ /dashboard unexpected response: status=${res.status}`
    );

    const { PrismaClient } = require("@prisma/client");
    const prisma = new PrismaClient();
    const org = await prisma.org.findUnique({
      where: { ownerUserId: data.user.id },
    });
    console.log(
      org
        ? `✅ Org row exists: ${org.id} (“${org.name}”)`
        : "❌ no Org row found"
    );
    await prisma.$disconnect();
    if (!greeted || !org) process.exit(1);
    return;
  }

  throw new Error("usage: node scripts/verify-phase0.js signup|signin");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
