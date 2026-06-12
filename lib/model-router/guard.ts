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
