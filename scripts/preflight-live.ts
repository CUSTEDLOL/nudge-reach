/**
 * Go-live preflight CLI: npm run preflight:live
 * Prints a pass/warn/fail table for everything the runbook needs.
 * Exits 1 if any check FAILs. Logic lives in src/lib/preflight.ts.
 */
import fs from "node:fs";
import path from "node:path";
import { runPreflight } from "@/lib/preflight";

const PROJECT_ROOT = process.env.PROJECT_ROOT ?? process.cwd();
for (const file of [".env.local", ".env"]) {
  const p = path.join(PROJECT_ROOT, file);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const ICON = { PASS: "✅", WARN: "⚠️ ", FAIL: "❌" } as const;

async function main() {
  const checks = await runPreflight(process.env, fetch);
  const width = Math.max(...checks.map((c) => c.name.length)) + 2;
  console.log(`\nNudge go-live preflight (SEND_MODE=${process.env.SEND_MODE ?? "simulation"})\n`);
  for (const c of checks) {
    console.log(`${ICON[c.status]} ${c.name.padEnd(width)} ${c.detail}`);
  }
  const fails = checks.filter((c) => c.status === "FAIL").length;
  const warns = checks.filter((c) => c.status === "WARN").length;
  console.log(
    `\n${checks.length} checks · ${checks.length - fails - warns} pass · ${warns} warn · ${fails} fail\n`
  );
  process.exit(fails > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("❌ preflight crashed:", err instanceof Error ? err.message : err);
  process.exit(2);
});
