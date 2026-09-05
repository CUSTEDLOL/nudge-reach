/**
 * Create or update the shared ElevenLabs agent and its standalone webhook tools.
 *
 *   npx esbuild scripts/voice-setup.ts --bundle --platform=node --format=cjs \
 *     --outfile=.next/voice-setup.cjs --external:@prisma/client && \
 *   PROJECT_ROOT=$PWD node .next/voice-setup.cjs
 *
 * Needs ELEVENLABS_API_KEY, VOICE_TOOLS_SECRET, VOICE_INITIATION_SECRET and
 * NEXT_PUBLIC_APP_URL in .env.local. If ELEVENLABS_AGENT_ID is present the
 * existing agent is updated; otherwise a new id is printed.
 */
import fs from "node:fs";
import path from "node:path";
import { assertRuntimeModelAllowed } from "../src/lib/model-router/guard";
import {
  buildElevenLabsAgentPayload,
  buildVoiceWebhookTool,
  VOICE_WEBHOOK_TOOL_SPECS,
} from "../src/modules/voice/elevenlabs-setup";

const ROOT = process.env.PROJECT_ROOT ?? process.cwd();
for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) {
  const match = line.match(/^([A-Z_]+)="?([^"]*)"?$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
}

const key = process.env.ELEVENLABS_API_KEY;
const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://nudgeagent.app").replace(/\/$/, "");
const llm = process.env.ELEVENLABS_LLM ?? "claude-haiku-4-5";
const toolsSecret = process.env.VOICE_TOOLS_SECRET;
const initiationSecret = process.env.VOICE_INITIATION_SECRET;
const existingAgentId = process.env.ELEVENLABS_AGENT_ID;
const API = "https://api.elevenlabs.io/v1/convai";

async function elevenLabs(pathname: string, init: RequestInit = {}) {
  const response = await fetch(`${API}${pathname}`, {
    ...init,
    headers: {
      "xi-api-key": key!,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(
      `ElevenLabs ${pathname}: HTTP ${response.status} ${JSON.stringify(json).slice(0, 500)}`
    );
  }
  return json;
}

async function upsertWebhookTool(
  spec: (typeof VOICE_WEBHOOK_TOOL_SPECS)[number]
): Promise<string> {
  const listed = (await elevenLabs(
    `/tools?search=${encodeURIComponent(spec.name)}&types=webhook&page_size=100`
  )) as {
    tools?: Array<{ id?: string; tool_config?: { name?: string } }>;
  };
  const match = listed.tools?.find((candidate) => candidate.tool_config?.name === spec.name);
  const body = { tool_config: buildVoiceWebhookTool(spec, appUrl, toolsSecret!) };
  if (match?.id) {
    await elevenLabs(`/tools/${encodeURIComponent(match.id)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    return match.id;
  }
  const created = (await elevenLabs("/tools", {
    method: "POST",
    body: JSON.stringify(body),
  })) as { id?: string };
  if (!created.id) throw new Error(`ElevenLabs did not return an id for tool ${spec.name}`);
  return created.id;
}

async function main() {
  if (!key || !toolsSecret || !initiationSecret) {
    throw new Error(
      "Set ELEVENLABS_API_KEY, VOICE_TOOLS_SECRET and VOICE_INITIATION_SECRET in .env.local first."
    );
  }
  if (!appUrl.startsWith("https://")) {
    throw new Error("NEXT_PUBLIC_APP_URL must be a public HTTPS URL for ElevenLabs webhooks.");
  }
  assertRuntimeModelAllowed(llm);

  const toolIds = await Promise.all(VOICE_WEBHOOK_TOOL_SPECS.map(upsertWebhookTool));
  const payload = buildElevenLabsAgentPayload({
    appUrl,
    initiationSecret,
    llm,
    toolIds,
  });
  const pathName = existingAgentId
    ? `/agents/${encodeURIComponent(existingAgentId)}`
    : "/agents/create";
  const json = (await elevenLabs(pathName, {
    method: existingAgentId ? "PATCH" : "POST",
    body: JSON.stringify(payload),
  })) as { agent_id?: string };
  const agentId = existingAgentId ?? json.agent_id;
  if (!agentId) throw new Error("ElevenLabs did not return an agent id");

  console.log(`ELEVENLABS_AGENT_ID=${agentId}`);
  console.log(`Updated webhook tools: ${VOICE_WEBHOOK_TOOL_SPECS.map((tool) => tool.name).join(", ")}`);
  console.log(
    "Next: Agents → Settings → Post-call webhooks → add",
    `${appUrl}/api/voice/post-call`,
    "and copy its secret into ELEVENLABS_WEBHOOK_SECRET."
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
