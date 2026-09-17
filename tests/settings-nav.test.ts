import { describe, expect, it } from "vitest";
import { SETTINGS_GROUPS } from "@/app/(app)/settings/settings-items";

describe("settings navigation taxonomy", () => {
  it("groups setup by workspace, channels and account", () => {
    expect(
      SETTINGS_GROUPS.map((group) => [
        group.label,
        group.items.map((item) => item.label),
      ])
    ).toEqual([
      ["Workspace", ["General", "Team", "Concierge"]],
      [
        "Channels & AI",
        ["WhatsApp", "AI model", "Website widget"],
      ],
      ["Account", ["Notifications", "Billing", "Data", "Audit log"]],
    ]);
  });

  it("does not duplicate top-level destinations", () => {
    const hrefs = SETTINGS_GROUPS.flatMap((group) =>
      group.items.map((item) => item.href)
    );

    expect(hrefs).not.toContain("/automations");
    expect(hrefs).not.toContain("/integrations");
  });

  it("leaves everything about the AI employee to the AI Front Desk", () => {
    const hrefs = SETTINGS_GROUPS.flatMap((group) =>
      group.items.map((item) => item.href)
    );

    // Owners set the AI up in one place. Settings keeps only account admin.
    expect(hrefs).not.toContain("/settings/voice");
    expect(hrefs).not.toContain("/settings/custom-actions");
    expect(hrefs).not.toContain("/agent/voice");
  });

  it("keeps every destination unique", () => {
    const hrefs = SETTINGS_GROUPS.flatMap((group) =>
      group.items.map((item) => item.href)
    );

    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
