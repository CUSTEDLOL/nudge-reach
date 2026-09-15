import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pagePath = "src/app/invite/[token]/page.tsx";
const formPath = "src/components/features/owner-setup-form.tsx";
const page = existsSync(pagePath) ? readFileSync(pagePath, "utf8") : "";
const form = existsSync(formPath) ? readFileSync(formPath, "utf8") : "";

describe("owner setup UI", () => {
  it("uses the real Nudge logo and explains which workspace is ready", () => {
    expect(page).toContain("<Logo");
    expect(page).toContain("findValidOwnerSetupInvite");
    expect(page).toMatch(/workspace is ready|ready for you/i);
    expect(page).toContain("invite.org.name");
  });

  it("keeps the invited email locked and both password fields blank", () => {
    expect(form).toContain('type="email"');
    expect(form).toContain("readOnly");
    expect(form).toContain('name="password"');
    expect(form).toContain('name="passwordConfirmation"');
    expect(form.match(/autoComplete="new-password"/g)?.length).toBe(2);
    expect(form).not.toMatch(/defaultValue=.*password/i);
    expect(form).not.toMatch(/value=.*password/i);
  });

  it("has accessible submission feedback and a sign-in recovery path", () => {
    expect(form).toContain("useActionState");
    expect(form).toContain("completeOwnerSetupAction");
    expect(form).toContain('aria-live="polite"');
    expect(form).toContain('href="/login"');
    expect(form).toMatch(/Set my password and continue/i);
  });

  it("uses one neutral state for invalid, expired, accepted, or replaced links", () => {
    expect(page).toMatch(/invalid or expired/i);
    expect(page).toMatch(/Ask Nudge\s+for a new setup link/i);
    expect(page).toContain('href="/login"');
  });
});
