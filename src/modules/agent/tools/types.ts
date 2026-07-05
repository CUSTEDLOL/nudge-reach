import { z } from "zod";
import type { AgentToolDef } from "@/lib/model-router";

/**
 * Everything a tool needs to act safely: the tenant + who it's talking to.
 * Every tool is scoped to THIS org — no tool can ever touch another business.
 */
export interface ToolContext {
  orgId: string;
  contactId: string;
  conversationId: string;
  /** Current stored contact name (equals the phone when we don't know it yet). */
  contactName: string;
  contactPhone: string;
}

export interface AgentTool {
  /** Schema shown to the model. */
  def: AgentToolDef;
  /** True if the tool has side effects (all of ours do — they're low-risk records). */
  write: boolean;
  /**
   * Validate the model's raw arguments, then run the handler. Never throws —
   * validation failures and handler errors come back as `isError` results the
   * model can recover from (re-ask the customer, or hand off).
   */
  parseAndRun: (
    ctx: ToolContext,
    rawInput: unknown
  ) => Promise<{ result: string; isError?: boolean }>;
}

export function defineTool<S extends z.ZodType>(config: {
  name: string;
  description: string;
  inputSchema: AgentToolDef["input_schema"];
  schema: S;
  write: boolean;
  handler: (ctx: ToolContext, input: z.infer<S>) => Promise<string>;
}): AgentTool {
  return {
    def: {
      name: config.name,
      description: config.description,
      input_schema: config.inputSchema,
    },
    write: config.write,
    async parseAndRun(ctx, rawInput) {
      const parsed = config.schema.safeParse(rawInput);
      if (!parsed.success) {
        const why = parsed.error.issues
          .map((i) => `${i.path.join(".") || "input"}: ${i.message}`)
          .join("; ");
        return {
          result: `Invalid input for ${config.name} (${why}). Ask the customer for the missing details, then try again.`,
          isError: true,
        };
      }
      try {
        return { result: await config.handler(ctx, parsed.data) };
      } catch {
        return {
          result: `The ${config.name} action could not be completed right now. Apologise briefly and let the customer know a team member will follow up.`,
          isError: true,
        };
      }
    },
  };
}
