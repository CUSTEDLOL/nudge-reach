import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  "src/components/marketing/meta-vs-nudge.tsx",
  "utf8"
);

describe("landing-page comparison section", () => {
  it("uses a semantic table for the approved hybrid comparison", () => {
    expect(source).toContain("Why businesses choose Nudge");
    expect(source).toContain("Meta's free AI");
    expect(source).toContain("WATI, AiSensy, Interakt");
    expect(source).toContain("Human receptionist");
    expect(source).toContain("<table");
    expect(source).toContain('scope="col"');
    expect(source).toContain('scope="row"');
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
      expect(source).toContain(outcome);
    }
  });

  it("keeps navigation stable and removes the scorecard interaction", () => {
    expect(source).toContain('id="compare"');
    expect(source).not.toContain("Biased scorecard");
    expect(source).not.toContain("LensChip");
    expect(source).not.toContain("PowerBar");
    expect(source).not.toContain("useState");
  });
});
