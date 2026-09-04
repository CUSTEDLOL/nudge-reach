import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { getPlan } from "@/modules/billing/plans";
import { isByokModelAllowed } from "@/lib/model-router/guard";
import { anthropicDriver } from "@/lib/model-router/drivers/anthropic";
import { openaiDriver } from "@/lib/model-router/drivers/openai";
import { geminiDriver } from "@/lib/model-router/drivers/gemini";
import type { DriverRuntime, LlmDriver, LlmProvider } from "@/lib/model-router/types";

/**
 * E3 BYO-LLM resolution: an enterprise org with a configured LlmAccount runs
 * its calls on its own provider + key. Anything invalid — missing plan flag,
 * unlisted model, undecryptable key, DB hiccup — falls back to the platform
 * path silently: a misconfigured BYO setup must never take the agent down.
 */

const DRIVERS: Record<LlmProvider, LlmDriver> = {
  anthropic: anthropicDriver,
  openai: openaiDriver,
  google: geminiDriver,
};

export function driverFor(provider: string): LlmDriver | null {
  return (DRIVERS as Record<string, LlmDriver>)[provider] ?? null;
}

export interface ByokRuntime {
  driver: LlmDriver;
  rt: DriverRuntime;
  provider: LlmProvider;
}

export async function getByokRuntime(orgId: string): Promise<ByokRuntime | null> {
  try {
    const account = await prisma.llmAccount.findUnique({ where: { orgId } });
    if (!account) return null;

    const org = await prisma.org.findUnique({
      where: { id: orgId },
      select: { plan: true },
    });
    if (!org || !getPlan(org.plan).limits.byoLlm) return null;
    if (!isByokModelAllowed(account.provider, account.model)) return null;

    const driver = driverFor(account.provider);
    if (!driver) return null;

    // The "sim" sentinel (calendar-accounts convention) stores no real key.
    if (account.apiKeyEncrypted === "sim") return null;
    const apiKey = decryptSecret(account.apiKeyEncrypted);
    return {
      driver,
      rt: { model: account.model, apiKey },
      provider: account.provider as LlmProvider,
    };
  } catch (err) {
    console.error("[byok] resolution failed — falling back to platform model", err);
    return null;
  }
}
