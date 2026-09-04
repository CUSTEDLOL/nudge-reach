import { prisma } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";
import { isByokModelAllowed } from "@/lib/model-router/guard";

/**
 * E3 BYO-LLM account CRUD (mirrors calendar/accounts.ts): one provider+key
 * per org, AES-encrypted at rest. The model-router's byok.ts is the reader.
 */

export interface LlmAccountView {
  provider: string;
  model: string;
  /** Key is never returned — only whether one is stored. */
  hasKey: boolean;
}

export async function getLlmAccount(orgId: string): Promise<LlmAccountView | null> {
  const row = await prisma.llmAccount.findUnique({ where: { orgId } });
  if (!row) return null;
  return {
    provider: row.provider,
    model: row.model,
    hasKey: row.apiKeyEncrypted !== "sim" && row.apiKeyEncrypted.length > 0,
  };
}

export async function saveLlmAccount(
  orgId: string,
  input: { provider: string; model: string; apiKey?: string }
): Promise<{ ok: boolean; message: string }> {
  if (!isByokModelAllowed(input.provider, input.model)) {
    return {
      ok: false,
      message: "Pick a provider and one of its supported models.",
    };
  }
  const existing = await prisma.llmAccount.findUnique({ where: { orgId } });
  if (!input.apiKey && !existing) {
    return { ok: false, message: "Paste the provider API key to connect." };
  }
  if (!input.apiKey && existing && existing.provider !== input.provider) {
    return {
      ok: false,
      message: "Switching provider needs that provider's API key — paste it in.",
    };
  }
  await prisma.llmAccount.upsert({
    where: { orgId },
    create: {
      orgId,
      provider: input.provider,
      model: input.model,
      apiKeyEncrypted: encryptSecret(input.apiKey!),
    },
    update: {
      provider: input.provider,
      model: input.model,
      // Blank key keeps the stored one.
      ...(input.apiKey ? { apiKeyEncrypted: encryptSecret(input.apiKey) } : {}),
    },
  });
  return { ok: true, message: "AI model saved — replies now run on your key." };
}

export async function deleteLlmAccount(orgId: string): Promise<void> {
  await prisma.llmAccount.deleteMany({ where: { orgId } });
}
