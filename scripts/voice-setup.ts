/**
 * One-shot: create the shared ElevenLabs agent for the Nudge voice front desk.
 *
 *   npx esbuild scripts/voice-setup.ts --bundle --platform=node --format=cjs \
 *     --outfile=.next/voice-setup.cjs --external:@prisma/client && \
 *   PROJECT_ROOT=$PWD node .next/voice-setup.cjs
 *
 * Needs ELEVENLABS_API_KEY, VOICE_TOOLS_SECRET, VOICE_INITIATION_SECRET and
 * NEXT_PUBLIC_APP_URL in .env.local. Prints ELEVENLABS_AGENT_ID. The LLM the
 * agent runs is ELEVENLABS_LLM, held to the same cheap-tier guard as the app.
 */
import fs from "node:fs";
import path from "node:path";
import { assertRuntimeModelAllowed } from "../src/lib/model-router/guard";

const ROOT = process.env.PROJECT_ROOT ?? process.cwd();
for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)="?([^"]*)"?$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const key = process.env.ELEVENLABS_API_KEY;
const app = process.env.NEXT_PUBLIC_APP_URL ?? "https://nudgeagent.app";
const llm = process.env.ELEVENLABS_LLM ?? "claude-haiku-4-5";
const toolsSecret = process.env.VOICE_TOOLS_SECRET;
const initSecret = process.env.VOICE_INITIATION_SECRET;

const tool = (
  name: string,
  description: string,
  properties: Record<string, unknown>,
  required: string[]
) => ({
  type: "webhook",
  name,
  description,
  api_schema: {
    url: `${app}/api/voice/tools/${name}`,
    method: "POST",
    request_headers: { Authorization: `Bearer ${toolsSecret}` },
    request_body_schema: {
      type: "object",
      required: ["org_id", "contact_phone", ...required],
      properties: {
        org_id: { type: "string", dynamic_variable: "org_id" },
        contact_phone: { type: "string", dynamic_variable: "contact_phone" },
        ...properties,
      },
    },
  },
});

async function main() {
  if (!key || !toolsSecret || !initSecret) {
    throw new Error("Set ELEVENLABS_API_KEY, VOICE_TOOLS_SECRET and VOICE_INITIATION_SECRET in .env.local first.");
  }
  assertRuntimeModelAllowed(llm);

  const res = await fetch("https://api.elevenlabs.io/v1/convai/agents/create", {
    method: "POST",
    headers: { "xi-api-key": key, "content-type": "application/json" },
    body: JSON.stringify({
      name: "Nudge Front Desk (shared)",
      conversation_config: {
        agent: {
          first_message: "Hello, how can I help you today?",
          language: "en",
          prompt: {
            prompt:
              "You are the front desk of a small business. The per-call instructions arrive at call start.",
            llm,
            temperature: 0.3,
            tools: [
              { type: "system", name: "end_call", description: "End the call when the caller is done." },
              {
                type: "system",
                name: "transfer_to_number",
                description: "Transfer to a human.",
                params: {
                  transfers: [
                    { phone_number: "{{transfer_to}}", condition: "The caller asks for a person or you cannot help." },
                  ],
                },
              },
              tool(
                "capture_booking_request",
                "Save an appointment/table request once name and time are confirmed.",
                {
                  name: { type: "string", description: "Caller's name" },
                  requested_for: { type: "string", description: "Day and time in the caller's words" },
                  party_size: { type: "integer", description: "Number of people, if relevant" },
                  notes: { type: "string", description: "Anything else" },
                },
                ["name", "requested_for"]
              ),
              tool(
                "capture_lead",
                "Record buying interest.",
                { name: { type: "string" }, interest: { type: "string", description: "What they want" }, details: { type: "string" } },
                ["interest"]
              ),
              tool(
                "ask_owner",
                "Ask the owner a question you cannot answer from the business information.",
                { question: { type: "string" } },
                ["question"]
              ),
              tool(
                "send_payment_link",
                "Send a payment link on WhatsApp for a deposit.",
                { amount: { type: "number" }, purpose: { type: "string" } },
                ["amount", "purpose"]
              ),
            ],
          },
        },
        tts: { model_id: "eleven_flash_v2_5" },
        // A front-desk call should never run long: hard-stop at 8 minutes and
        // hang up on ~10s of silence, so a forgotten open line can't burn the
        // client's minute allowance.
        conversation: { max_duration_seconds: 480 },
        turn: { turn_timeout: 10 },
      },
      platform_settings: {
        workspace_overrides: {
          conversation_initiation_client_data_webhook: {
            url: `${app}/api/voice/initiation`,
            request_headers: { "x-nudge-voice-secret": initSecret },
          },
        },
      },
    }),
  });
  const json = (await res.json()) as { agent_id?: string; detail?: unknown };
  if (!res.ok || !json.agent_id) {
    throw new Error(`create agent failed: ${JSON.stringify(json.detail ?? json)}`);
  }
  console.log(`ELEVENLABS_AGENT_ID=${json.agent_id}`);
  console.log(
    "Next: Agents → Settings → Post-call webhooks → add",
    `${app}/api/voice/post-call`,
    "and copy its secret into ELEVENLABS_WEBHOOK_SECRET."
  );
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
