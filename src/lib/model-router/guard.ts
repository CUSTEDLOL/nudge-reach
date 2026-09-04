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
 * E3 BYO-LLM: the curated model allow-list per provider. Hand-set — a junk
 * or luxury model id is rejected at save time AND at call time. Platform-paid
 * calls never consult this; they stay on the guarded RUNTIME_MODEL above.
 */
export const BYOK_ALLOWED_MODELS: Record<string, string[]> = {
  anthropic: ["claude-sonnet-5", "claude-haiku-4-5"],
  openai: ["gpt-5.2", "gpt-5-mini"],
  google: ["gemini-3-pro", "gemini-3-flash"],
};

export function isByokModelAllowed(provider: string, model: string): boolean {
  return (BYOK_ALLOWED_MODELS[provider] ?? []).includes(model);
}
