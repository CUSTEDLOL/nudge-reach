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
        ["WhatsApp", "Voice", "Agent actions", "AI model", "Website widget"],
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

  it("keeps every destination unique", () => {
    const hrefs = SETTINGS_GROUPS.flatMap((group) =>
      group.items.map((item) => item.href)
    );

    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
