/**
 * Create or update the shared ElevenLabs agent and its standalone webhook tools.
 *
 *   npx esbuild scripts/voice-setup.ts --bundle --platform=node --format=cjs \
 *     --outfile=.next/voice-setup.cjs --external:@prisma/client && \
 *   PROJECT_ROOT=$PWD node .next/voice-setup.cjs
 *
 * Needs ELEVENLABS_API_KEY, VOICE_TOOLS_SECRET, VOICE_INITIATION_SECRET and
 * NEXT_PUBLIC_APP_URL in .env.local. If ELEVENLABS_AGENT_ID is present the
 * existing agent is updated; otherwise a new id is printed. Also creates the
 * post-call webhook (its secret is printed once, on creation) and points the
 * workspace at the initiation + post-call webhooks. Safe to re-run.
 */
import fs from "node:fs";
import path from "node:path";
import { assertRuntimeModelAllowed } from "../src/lib/model-router/guard";
import {
  buildElevenLabsAgentPayload,
  buildVoiceWebhookTool,
  buildWorkspaceSettingsPayload,
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
const API = "https://api.elevenlabs.io/v1";

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
    `/convai/tools?search=${encodeURIComponent(spec.name)}&types=webhook&page_size=100`
  )) as {
    tools?: Array<{ id?: string; tool_config?: { name?: string } }>;
  };
  const match = listed.tools?.find((candidate) => candidate.tool_config?.name === spec.name);
  const body = { tool_config: buildVoiceWebhookTool(spec, appUrl, toolsSecret!) };
  if (match?.id) {
    await elevenLabs(`/convai/tools/${encodeURIComponent(match.id)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    return match.id;
  }
  const created = (await elevenLabs("/convai/tools", {
    method: "POST",
    body: JSON.stringify(body),
  })) as { id?: string };
  if (!created.id) throw new Error(`ElevenLabs did not return an id for tool ${spec.name}`);
  return created.id;
}

/** The workspace post-call webhook for this app URL — created once, reused after. */
async function ensurePostCallWebhook(): Promise<{ id: string; secret?: string }> {
  const url = `${appUrl}/api/voice/post-call`;
  const listed = (await elevenLabs("/workspace/webhooks")) as {
    webhooks?: Array<{ webhook_id?: string; webhook_url?: string }>;
  };
  const existing = listed.webhooks?.find((hook) => hook.webhook_url === url);
  if (existing?.webhook_id) return { id: existing.webhook_id };
  const created = (await elevenLabs("/workspace/webhooks", {
    method: "POST",
    body: JSON.stringify({
      settings: { auth_type: "hmac", name: "Nudge post-call", webhook_url: url },
    }),
  })) as { webhook_id?: string; webhook_secret?: string };
  if (!created.webhook_id) throw new Error("ElevenLabs did not return a webhook id");
  return { id: created.webhook_id, secret: created.webhook_secret };
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
    ? `/convai/agents/${encodeURIComponent(existingAgentId)}`
    : "/convai/agents/create";
  const json = (await elevenLabs(pathName, {
    method: existingAgentId ? "PATCH" : "POST",
    body: JSON.stringify(payload),
  })) as { agent_id?: string };
  const agentId = existingAgentId ?? json.agent_id;
  if (!agentId) throw new Error("ElevenLabs did not return an agent id");

  const webhook = await ensurePostCallWebhook();
  await elevenLabs("/convai/settings", {
    method: "PATCH",
    body: JSON.stringify(
      buildWorkspaceSettingsPayload({ appUrl, initiationSecret, postCallWebhookId: webhook.id })
    ),
  });

  console.log(`ELEVENLABS_AGENT_ID=${agentId}`);
  console.log(`Updated webhook tools: ${VOICE_WEBHOOK_TOOL_SPECS.map((tool) => tool.name).join(", ")}`);
  console.log(
    webhook.secret
      ? `ELEVENLABS_WEBHOOK_SECRET=${webhook.secret}`
      : "Post-call webhook already existed — keep the ELEVENLABS_WEBHOOK_SECRET you have."
  );
  console.log("Next: bash scripts/voice-push-env.sh (copies the voice env into Vercel and deploys).");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
