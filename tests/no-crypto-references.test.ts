import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The crypto pay rail was removed on 2026-09-01 (PLAN.md WS1) and the founders
 * require ZERO references to it anywhere. This test fails the suite if any
 * banned term is reintroduced in source, tests, docs, schema, scripts, env
 * examples or top-level docs.
 */

const ROOT = join(__dirname, "..");
const SCAN_ROOTS = ["src", "tests", "docs", "prisma", "scripts"];
const SCAN_FILES = [".env.example", "README.md", "AGENTS.md", "PROGRESS.md", "PLAN.md"];
const BANNED = /usdc|x402|stablecoin|on-?chain|escrow|wallet/i;
const TEXT_EXT = /\.(ts|tsx|js|mjs|cjs|md|json|prisma|txt|html|css)$/;
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "superpowers"]);
// This file names the banned terms on purpose; nothing else may.
const ALLOWED = new Set(["tests/no-crypto-references.test.ts"]);

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (TEXT_EXT.test(entry)) yield full;
  }
}

describe("no crypto-rail references remain", () => {
  it("bans usdc/x402/stablecoin/on-chain/escrow/wallet across the repo", () => {
    const offenders: string[] = [];
    const files = [
      ...SCAN_ROOTS.flatMap((d) => [...walk(join(ROOT, d))]),
      ...SCAN_FILES.map((f) => join(ROOT, f)),
    ];
    for (const file of files) {
      const rel = relative(ROOT, file);
      if (ALLOWED.has(rel)) continue;
      let text: string;
      try {
        text = readFileSync(file, "utf8");
      } catch {
        continue; // listed top-level file may not exist
      }
      for (const [i, line] of text.split("\n").entries()) {
        if (BANNED.test(line)) offenders.push(`${rel}:${i + 1}: ${line.trim().slice(0, 100)}`);
      }
    }
    expect(offenders, `banned crypto terms found:\n${offenders.join("\n")}`).toEqual([]);
  });
});
