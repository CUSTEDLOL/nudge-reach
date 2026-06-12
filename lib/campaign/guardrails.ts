import {
  campaignContentSchema,
  type CampaignContent,
} from "@/lib/campaign/schema";

/**
 * Guardrails in code, not left to the model (PRD §7): defensive JSON
 * parsing, exactly one {{1}} personalization variable, and a mandatory
 * opt-out footer. All pure functions — unit-tested.
 */

export type ParseResult =
  | { ok: true; value: unknown }
  | { ok: false; error: string };

/** Strip markdown code fences and any prose around the outermost JSON object. */
export function extractJson(text: string): ParseResult {
  const withoutFences = text.replace(/```(?:json)?/gi, "");
  const start = withoutFences.indexOf("{");
  const end = withoutFences.lastIndexOf("}");
  if (start === -1 || end <= start) {
    return { ok: false, error: "No JSON object found in model output." };
  }
  try {
    return { ok: true, value: JSON.parse(withoutFences.slice(start, end + 1)) };
  } catch (err) {
    return {
      ok: false,
      error: `Invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/** Body must contain {{1}} exactly once, near the start. */
export function repairPersonalization(body: string): string {
  const matches = body.match(/\{\{1\}\}/g) ?? [];
  if (matches.length === 1) return body;
  if (matches.length === 0) return `Hi {{1}}! ${body}`;
  // Keep the first occurrence, drop the rest.
  let seen = false;
  return body.replace(/\{\{1\}\}/g, () => {
    if (seen) return "";
    seen = true;
    return "{{1}}";
  });
}

/** Footer must contain an opt-out instruction. */
export function repairOptOutFooter(footer: string): string {
  if (/\bstop\b/i.test(footer)) return footer.slice(0, 60);
  const standard = "Reply STOP to unsubscribe";
  if (!footer.trim()) return standard;
  const combined = `${footer.trim()} · ${standard}`;
  return combined.length <= 60 ? combined : standard;
}

/**
 * Validate the parsed object against the schema, applying repairs first.
 * Throws with a readable message when the shape is beyond repair.
 */
export function repairAndValidate(raw: unknown): CampaignContent {
  const candidate =
    typeof raw === "object" && raw !== null
      ? (raw as Record<string, unknown>)
      : {};

  if (typeof candidate.body === "string") {
    candidate.body = repairPersonalization(candidate.body).slice(0, 1024);
  }
  candidate.footer = repairOptOutFooter(
    typeof candidate.footer === "string" ? candidate.footer : ""
  );
  if (typeof candidate.header === "string") {
    candidate.header = candidate.header.slice(0, 60);
  }
  if (Array.isArray(candidate.buttons)) {
    candidate.buttons = candidate.buttons.slice(0, 3);
  }

  const parsed = campaignContentSchema.safeParse(candidate);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Campaign shape invalid after repair: ${problems}`);
  }
  return parsed.data;
}
