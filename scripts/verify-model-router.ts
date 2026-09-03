/**
 * Phase 1 acceptance: "model-router returns text for a test prompt."
 * Exercises the same SDK call shape as lib/model-router/index.ts with the
 * RUNTIME_MODEL from .env.local, guarded by the REAL runtime-model guard
 * (single source — no duplicated regex).
 */
import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { assertRuntimeModelAllowed } from "@/lib/model-router/guard";

const PROJECT_ROOT = process.env.PROJECT_ROOT ?? process.cwd();
for (const line of fs
  .readFileSync(path.join(PROJECT_ROOT, ".env.local"), "utf8")
  .split("\n")) {
  const m = line.match(/^([A-Z_]+)="?([^"]*)"?$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const model = process.env.RUNTIME_MODEL || "claude-haiku-4-5";
try {
  assertRuntimeModelAllowed(model);
} catch (err) {
  console.error(`❌ ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}

async function main() {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model,
    max_tokens: 100,
    system: "You are a helpful assistant for Indian retail shops.",
    messages: [
      {
        role: "user",
        content:
          "In one short sentence: why is a festival sale a good time for a WhatsApp campaign?",
      },
    ],
  });
  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("");
  console.log(`✅ model: ${response.model}`);
  console.log(`✅ text: ${text}`);
  console.log(
    `✅ usage: ${response.usage.input_tokens} in / ${response.usage.output_tokens} out`
  );
}

main().catch((err) => {
  console.error("❌", err instanceof Error ? err.message : err);
  process.exit(1);
});
