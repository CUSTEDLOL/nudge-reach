import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MetaVsNudge } from "@/components/marketing/meta-vs-nudge";

const source = readFileSync(
  "src/components/marketing/meta-vs-nudge.tsx",
  "utf8"
);
const html = renderToStaticMarkup(MetaVsNudge());
const text = html
  .replace(/<[^>]+>/g, " ")
  .replaceAll("&#x27;", "'")
  .replaceAll("&quot;", '"')
  .replace(/\s+/g, " ")
  .trim();

describe("landing-page competitor decision ledger", () => {
  it("compares every option through the same three buyer questions", () => {
    expect(text).toContain("COMPETITOR ANALYSIS");
    expect(text).toContain("FOUR WAYS TO RUN WHATSAPP.");
    expect(text).toContain(
      "Compare what each handles, what stays with you, and who it fits."
    );

    for (const heading of [
      "Option",
      "What it handles",
      "What you still own",
      "Best for",
    ]) {
      expect(text).toContain(heading);
    }
  });

  it("states capabilities, ownership and best fit for all four choices", () => {
    const approvedCopy = [
      "Nudge AI Front Desk",
      "Managed service",
      "Replies, bookings, deposits and quiet-lead recovery.",
      "Set the rules. Nudge configures and runs it.",
      "Owners who want the outcome managed.",
      "Meta Business Agent",
      "Native WhatsApp AI",
      "Questions, recommendations, qualification and appointments.",
      "Setup, connected workflows and ongoing oversight.",
      "Simple AI inside WhatsApp.",
      "WhatsApp CRM tools",
      "WATI · AiSensy · Interakt",
      "Inbox, campaigns, AI agents and automations.",
      "Workflow design, integrations and daily operation.",
      "Teams that want platform control.",
      "Human receptionist",
      "Traditional hire",
      "Conversations, exceptions and manual follow-up.",
      "Hiring, training, scheduling and cover.",
      "Businesses needing human judgment.",
    ];

    for (const copy of approvedCopy) {
      expect(text).toContain(copy);
    }

    expect(text).toContain(
      "Capabilities, services and pricing vary by provider, plan and market."
    );
  });

  it("uses semantic desktop and mobile structures without horizontal scrolling", () => {
    expect(html).toContain('id="compare"');
    expect(html).toContain("<table");
    expect(html).toContain("<caption");
    expect(html.match(/<th[^>]*scope="col"/g)).toHaveLength(4);
    expect(html.match(/<th[^>]*scope="row"/g)).toHaveLength(4);
    expect(html.match(/<dl/g)).toHaveLength(4);
    expect(source).toContain("lg:table");
    expect(source).toContain("lg:hidden");

    expect(source).not.toContain("overflow-x-auto");
    expect(source).not.toContain("min-w-[");
    expect(source).not.toContain("useState");
  });

  it("removes the rejected bento and tiny decorative clutter", () => {
    expect(source).not.toContain("JOURNEY_STEPS");
    expect(source).not.toContain("linear-gradient");
    expect(source).not.toContain("Hi, is Saturday available?");
    expect(source).not.toContain("backdropWord");
    expect(source).not.toContain("CARD_MOTION");
    expect(source).not.toContain("hover:");
    expect(source).not.toContain("text-[10px]");
    expect(source.match(/rounded-\[1\.75rem\]/g)).toHaveLength(1);
  });
});
