import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("adaptive onboarding navigation", () => {
  it("keeps a visible back control on every one-tap choice question", () => {
    const source = readFileSync(
      "src/app/(app)/onboarding/wizard.tsx",
      "utf8"
    );

    expect(source.match(/<ChoiceBackControl/g)).toHaveLength(1);
    expect(source).toContain("disabled={step === 1}");
  });

  it("uses the official Nudge assets in expanded and compact navigation", () => {
    const source = readFileSync(
      "src/components/features/app-shell/brand-mark.tsx",
      "utf8"
    );

    expect(source).toContain('src="/logo-mark.png"');
    expect(source).toContain('src="/icon.svg"');
    expect(source).not.toContain("<svg");
  });

  it("shows saved values only after their question has been completed", () => {
    const source = readFileSync(
      "src/app/(app)/onboarding/wizard.tsx",
      "utf8"
    );

    expect(source.match(/value=\{visibleChoiceValue\(/g) ?? []).toHaveLength(1);
    expect(source).toMatch(
      /visibleChoiceValue\(\s*profile\.primaryOutcome,\s*1,\s*profile\.lastCompletedStep\s*\)/
    );
  });
});
