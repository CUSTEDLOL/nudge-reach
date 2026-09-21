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

/**
 * Why a given org's calls are (or are not) running on its own key.
 *
 * `fallback` is the dangerous one: the org has a key configured and believes
 * it is paying its own provider, but every call is quietly running on the
 * platform key and burning platform credits. The fallback itself is correct
 * and must stay — a misconfigured BYO setup can never take the agent down —
 * but it must not be invisible, so the founder panel reads this.
 */
export type ByokStatus =
  | { state: "none" }
  | { state: "simulated"; provider: string; model: string }
  | { state: "active"; provider: string; model: string }
  | { state: "fallback"; provider: string; model: string; reason: string };

/** One resolution, used for both the runtime and the status, so they cannot drift. */
async function resolve(
  orgId: string
): Promise<{ status: ByokStatus; runtime?: ByokRuntime }> {
  let account: { provider: string; model: string; apiKeyEncrypted: string } | null = null;
  try {
    account = await prisma.llmAccount.findUnique({ where: { orgId } });
    if (!account) return { status: { state: "none" } };
    const { provider, model } = account;

    const org = await prisma.org.findUnique({
      where: { id: orgId },
      select: { plan: true },
    });
    if (!org || !getPlan(org.plan).limits.byoLlm) {
      return {
        status: {
          state: "fallback",
          provider,
          model,
          reason: "the org's plan no longer includes BYO-LLM",
        },
      };
    }
    if (!isByokModelAllowed(provider, model)) {
      return {
        status: {
          state: "fallback",
          provider,
          model,
          reason: `model "${model}" is not on the allow-list for ${provider}`,
        },
      };
    }

    const driver = driverFor(provider);
    if (!driver) {
      return {
        status: { state: "fallback", provider, model, reason: `no driver for ${provider}` },
      };
    }

    // The "sim" sentinel (calendar-accounts convention) stores no real key.
    if (account.apiKeyEncrypted === "sim") {
      return { status: { state: "simulated", provider, model } };
    }
    const apiKey = decryptSecret(account.apiKeyEncrypted);
    return {
      status: { state: "active", provider, model },
      runtime: { driver, rt: { model, apiKey }, provider: provider as LlmProvider },
    };
  } catch (err) {
    console.error("[byok] resolution failed — falling back to platform model", err);
    return {
      status: {
        state: "fallback",
        provider: account?.provider ?? "unknown",
        model: account?.model ?? "unknown",
        reason: "the stored key could not be read",
      },
    };
  }
}

export async function getByokRuntime(orgId: string): Promise<ByokRuntime | null> {
  return (await resolve(orgId)).runtime ?? null;
}

/** Read-only: what the founder panel shows. Never throws, never returns a key. */
export async function byokStatus(orgId: string): Promise<ByokStatus> {
  return (await resolve(orgId)).status;
}
