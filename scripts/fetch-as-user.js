/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Fetch an app page as the signed-in test user and grep for expected strings.
 * Usage: node scripts/fetch-as-user.js /campaigns/abc "Expected text" "More text"
 */
const { createClient } = require("@supabase/supabase-js");
const fs = require("node:fs");
const path = require("node:path");

for (const line of fs
  .readFileSync(path.join(__dirname, "..", ".env.local"), "utf8")
  .split("\n")) {
  const m = line.match(/^([A-Z_]+)="?([^"]*)"?$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const REF = new URL(URL_).hostname.split(".")[0];
const BASE = process.env.APP_URL || "http://localhost:3000";

function cookies(session) {
  const value =
    "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  const name = `sb-${REF}-auth-token`;
  const MAX = 3180;
  if (value.length <= MAX) return [`${name}=${value}`];
  const out = [];
  for (let i = 0; i * MAX < value.length; i++) {
    out.push(`${name}.${i}=${value.slice(i * MAX, (i + 1) * MAX)}`);
  }
  return out;
}

async function main() {
  const [pagePath, ...expected] = process.argv.slice(2);
  const supabase = createClient(URL_, KEY);
  const { data, error } = await supabase.auth.signInWithPassword({
    email: "visheshjain1705+nudgetest@gmail.com",
    password: "NudgeTest!2026",
  });
  if (error) throw new Error(error.message);

  const res = await fetch(`${BASE}${pagePath}`, {
    headers: { cookie: cookies(data.session).join("; ") },
  });
  const html = await res.text();
  console.log(`${pagePath} → HTTP ${res.status}`);
  let failed = false;
  for (const text of expected) {
    const found = html.includes(text);
    console.log(`${found ? "✅" : "❌"} contains: ${text}`);
    if (!found) failed = true;
  }
  if (res.status !== 200 || failed) process.exit(1);
}

main().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
