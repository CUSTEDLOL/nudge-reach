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

describe("landing-page comparison section", () => {
  it("turns one late-night enquiry into a complete Nudge outcome", () => {
    expect(text).toContain("THE DIFFERENCE ISN'T MORE FEATURES.");
    expect(text).toContain("It's who does the work.");
    expect(text).toContain("Hi, is Saturday available?");
    expect(text).toContain("11:47 PM");
    expect(text).toContain("Nudge AI Front Desk");
    expect(text).toContain(
      "Booked. Deposit collected. Follow-up handled."
    );

    for (const step of [
      "Replied",
      "Calendar checked",
      "Deposit received",
      "Follow-up ready",
    ]) {
      expect(text).toContain(step);
    }
  });

  it("compares operating models without denying competitor capabilities", () => {
    expect(text).toContain("Meta's AI");
    expect(text).toContain("A capable agent for incoming conversations.");
    expect(text).toContain("You connect + oversee");

    expect(text).toContain("CRM tools");
    expect(text).toContain(
      "Powerful software for building WhatsApp workflows."
    );
    expect(text).toContain("WATI · AiSensy · Interakt");
    expect(text).toContain("Your team or partner operates");

    expect(text).toContain("Human receptionist");
    expect(text).toContain("A capable person behind the desk.");
    expect(text).toContain("You hire + train + cover shifts");

    expect(source).not.toContain("No real-system action");
    expect(source).not.toContain("Inbound only");
    expect(source).not.toContain("Doesn't collect payment");
  });

  it("uses a static, semantic card structure that stacks on mobile", () => {
    expect(html).toContain('id="compare"');
    expect(html).toContain(
      'aria-label="How Nudge handles the same enquiry compared with alternatives"'
    );
    expect(html.match(/<article/g)).toHaveLength(4);
    expect(html.match(/aria-labelledby=/g)).toHaveLength(4);
    expect(text).toContain("With Nudge, the front desk is the product.");

    expect(source).not.toContain("<table");
    expect(source).not.toContain('scope="col"');
    expect(source).not.toContain("Swipe to compare");
    expect(source).not.toContain("overflow-x-auto");
    expect(source).not.toContain("useState");
  });
});
