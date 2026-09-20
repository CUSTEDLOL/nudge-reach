/**
 * Rule 3 enforcement, in code: the runtime must never call an expensive
 * model. Build-time engineering uses Fable/Opus; the deployed app does not.
 * Pure function so it can be unit-tested without an API key.
 */

const FORBIDDEN_RUNTIME_MODELS = ["opus", "fable", "mythos"];

export function assertRuntimeModelAllowed(model: string): void {
  const lower = model.toLowerCase();
  for (const forbidden of FORBIDDEN_RUNTIME_MODELS) {
    if (lower.includes(forbidden)) {
      throw new Error(
        `RUNTIME_MODEL "${model}" is an expensive build-time model and must ` +
          `never run in the app (CLAUDE.md rule 3). Use a cheap ` +
          `vision-capable tier like "claude-haiku-4-5".`
      );
    }
  }
}

/**
 * E3 BYO-LLM: the curated catalogue of models a customer may bring a key for.
 * Hand-set — a junk or luxury model id is rejected at save time AND at call
 * time. Platform-paid calls never consult this; they stay on the guarded
 * RUNTIME_MODEL above.
 *
 * ONE source of truth: the customer's picker renders from this and the
 * allow-list below is derived from it. It used to be duplicated in
 * `settings/ai/ai-form.tsx`, and the two drifted — `gemini-3-pro` and
 * `gemini-3-flash` sat in both for months and are not real Google API ids,
 * so those calls passed every local check and were rejected by Google.
 *
 * Every id here must be a literal API model string copied from the
 * provider's own docs, and must have a rate in `billing/credit-rates.ts`
 * (enforced by tests/byok-model-catalogue.test.ts).
 */
export interface ByokProvider {
  id: string;
  label: string;
  models: { id: string; label: string }[];
}

export const BYOK_CATALOGUE: ByokProvider[] = [
  {
    id: "anthropic",
    label: "Anthropic (Claude)",
    models: [
      { id: "claude-sonnet-5", label: "Claude Sonnet (recommended)" },
      { id: "claude-haiku-4-5", label: "Claude Haiku (fastest)" },
    ],
  },
  {
    id: "openai",
    label: "OpenAI (GPT)",
    models: [
      { id: "gpt-5.2", label: "GPT-5.2" },
      { id: "gpt-5-mini", label: "GPT-5 mini (fastest)" },
    ],
  },
  {
    id: "google",
    label: "Google (Gemini)",
    models: [
      // Google ships versioned ids only; there is no `gemini-3-pro` and no
      // `gemini-3-flash`. Gemini 3 Pro is preview-only today, so it is
      // deliberately not offered — a preview id can be withdrawn and would
      // recreate exactly the bug above.
      { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash (recommended)" },
      { id: "gemini-3.7-flash", label: "Gemini 3.7 Flash" },
    ],
  },
];

export const BYOK_ALLOWED_MODELS: Record<string, string[]> = Object.fromEntries(
  BYOK_CATALOGUE.map((p) => [p.id, p.models.map((m) => m.id)])
);

export function isByokModelAllowed(provider: string, model: string): boolean {
  return (BYOK_ALLOWED_MODELS[provider] ?? []).includes(model);
}
