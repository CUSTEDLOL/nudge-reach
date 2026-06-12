/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Phase 1 acceptance: "model-router returns text for a test prompt."
 * Exercises the same SDK call shape as lib/model-router/index.ts with the
 * RUNTIME_MODEL from .env.local. (The router's model guard is unit-tested
 * separately; the full TS code path runs live in the Phase 2 generate flow.)
 */
const Anthropic = require("@anthropic-ai/sdk").default;
const fs = require("node:fs");
const path = require("node:path");

for (const line of fs
  .readFileSync(path.join(__dirname, "..", ".env.local"), "utf8")
  .split("\n")) {
  const m = line.match(/^([A-Z_]+)="?([^"]*)"?$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const model = process.env.RUNTIME_MODEL || "claude-haiku-4-5";
if (/opus|fable|mythos/i.test(model)) {
  console.error(`❌ rule 3 violation: ${model}`);
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
    .map((b) => b.text)
    .join("");
  console.log(`✅ model: ${response.model}`);
  console.log(`✅ text: ${text}`);
  console.log(
    `✅ usage: ${response.usage.input_tokens} in / ${response.usage.output_tokens} out`
  );
}

main().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
