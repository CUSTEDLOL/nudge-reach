import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("adaptive onboarding navigation", () => {
  it("keeps a visible back control on every one-tap choice question", () => {
    const source = readFileSync(
      "src/app/(app)/onboarding/wizard.tsx",
      "utf8"
    );

    expect(source.match(/<ChoiceBackControl/g)).toHaveLength(5);
    expect(source).toContain("disabled={step === 1}");
  });
});
