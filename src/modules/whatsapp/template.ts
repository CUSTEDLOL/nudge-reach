import type { CampaignContent } from "@/modules/campaign/schema";

/**
 * Build the Meta `message_templates` create payload from campaign content.
 * Unit-tested against the reference example in docs/WHATSAPP_CLOUD_API.md.
 *
 * Meta allows ONE header (text OR image). When the product has a photo we
 * use an IMAGE header and fold the campaign's text header into the body as
 * a bold first line — the photo is the product's hero (PRD: photo in →
 * campaign out).
 */

export interface BuildTemplateOptions {
  name: string;
  language?: string;
  /** Media handle from the resumable upload API (live) or a mock (simulation). */
  headerImageHandle?: string;
}

/** Meta template names: lowercase letters, digits, underscores, ≤512 chars. */
export function slugifyTemplateName(productName: string, suffix: string): string {
  const slug = productName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 100);
  return `${slug || "campaign"}_${suffix}`;
}

export function buildTemplatePayload(
  content: CampaignContent,
  options: BuildTemplateOptions
) {
  const language = options.language ?? "en";
  const components: Array<Record<string, unknown>> = [];

  let body = content.body;
  if (options.headerImageHandle) {
    components.push({
      type: "HEADER",
      format: "IMAGE",
      example: { header_handle: [options.headerImageHandle] },
    });
    // Fold the text header into the body as a bold first line.
    body = `*${content.header}*\n\n${content.body}`;
  } else {
    components.push({
      type: "HEADER",
      format: "TEXT",
      text: content.header,
    });
  }

  components.push({
    type: "BODY",
    text: body,
    example: { body_text: [[content.sampleName]] },
  });

  components.push({ type: "FOOTER", text: content.footer });

  if (content.buttons.length > 0) {
    components.push({
      type: "BUTTONS",
      buttons: content.buttons.map((button) =>
        button.type === "URL"
          ? { type: "URL", text: button.text, url: button.url }
          : { type: "QUICK_REPLY", text: button.text }
      ),
    });
  }

  return {
    name: options.name,
    language,
    category: "MARKETING" as const, // forced — never disguise marketing
    components,
  };
}
