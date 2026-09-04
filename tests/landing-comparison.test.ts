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
  .replace(/\s+/g, " ")
  .trim();

describe("landing-page comparison section", () => {
  it("uses a semantic table for the approved hybrid comparison", () => {
    expect(text).toContain("Why businesses choose Nudge");
    expect(text).toContain("Meta's free AI");
    expect(text).toContain("WATI, AiSensy, Interakt");
    expect(text).toContain("Human receptionist");
    expect(html).toContain("<table");
    expect(html).toContain('scope="col"');
    expect(html).toContain('scope="row"');
  });

  it("compares the eight outcomes customers care about", () => {
    for (const outcome of [
      "Answers every new enquiry",
      "Books into your real calendar",
      "Chases leads who go quiet",
      "Sends payment links",
      "Recovers no-shows",
      "Setup and training",
      "Works after hours",
      "Who operates it?",
    ]) {
      expect(text).toContain(outcome);
    }
  });

  it("keeps navigation stable and removes the scorecard interaction", () => {
    expect(html).toContain('id="compare"');
    expect(source).not.toContain("Biased scorecard");
    expect(source).not.toContain("LensChip");
    expect(source).not.toContain("PowerBar");
    expect(source).not.toContain("useState");
  });
});
