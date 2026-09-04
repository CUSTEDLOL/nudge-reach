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
    expect(html.match(/<th[^>]*scope="col"/g)).toHaveLength(5);
    expect(html.match(/<th[^>]*scope="row"/g)).toHaveLength(8);
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

  it("keeps named-platform claims credible", () => {
    expect(text).toContain("Available on some plans");
    expect(text).toContain("Available via automations");
    expect(text).toContain("24/7 once configured");
    expect(text).toContain("Self-serve or paid onboarding");
    expect(source).not.toContain("Automations only");
    expect(source).not.toContain("Only when remembered");
  });

  it("uses accessible contrast and workable mobile column widths", () => {
    expect(html).toContain('aria-label="Nudge competitor comparison"');
    expect(html).toContain('tabindex="0"');
    expect(source).toContain("bg-brand-800 text-white");
    expect(source).toContain("min-w-[145px]");
    expect(source).toContain("min-w-[180px]");
    expect(source).toContain("text-ink/60");
  });
});
