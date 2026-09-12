import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  "src/app/admin/orgs/[id]/integrations/page.tsx",
  "utf8"
);

describe("founder integrations page", () => {
  it("renders the complete assisted WhatsApp connection form", () => {
    expect(source).toContain("connectWhatsappAction");
    expect(source).toContain('name="displayName"');
    expect(source).toContain('name="wabaId"');
    expect(source).toContain('name="phoneNumberId"');
    expect(source).toContain('name="accessToken"');
  });

  it("keeps the Meta token masked and out of autocomplete", () => {
    expect(source).toMatch(
      /<input[\s\S]*?name="accessToken"[\s\S]*?type="password"[\s\S]*?autoComplete="new-password"/
    );
  });

  it("requires a reason and confirmation before saving credentials", () => {
    const start = source.indexOf("action={connectWhatsappAction}");
    const form = source.slice(start, source.indexOf("</ActionForm>", start));

    expect(start).toBeGreaterThan(-1);
    expect(form).toContain("askReason");
    expect(form).toContain("confirm={{");
    expect(form).toContain("Validate & save");
  });

  it("states that connecting credentials does not enable live sending", () => {
    expect(source).toMatch(/does not (enable|switch).*live|sending mode.*not.*changed/i);
    expect(source).toMatch(/Controls/);
  });
});
