import { describe, expect, it } from "vitest";
import {
  activeNavKey,
  mobilePrimaryItemsForRole,
  navGroupsForRole,
} from "@/components/features/app-shell/nav";

describe("adaptive app navigation", () => {
  it("puts owner destinations in the approved stable group order", () => {
    expect(
      navGroupsForRole("OWNER").map((group) => [
        group.label,
        group.items.map((item) => item.label),
      ])
    ).toEqual([
      ["Workspace", ["Today", "Inbox", "Leads"]],
      [
        "Automation",
        ["AI Front Desk", "Follow-ups", "Campaigns"],
      ],
      ["Insights", ["Analytics"]],
      ["Manage", ["Integrations", "Settings"]],
    ]);
  });

  it("keeps the agent workspace focused on destinations the role can use", () => {
    const keys = navGroupsForRole("AGENT").flatMap((group) =>
      group.items.map((item) => item.key)
    );

    expect(keys).toEqual([
      "today",
      "inbox",
      "leads",
      "front-desk",
      "campaigns",
    ]);
  });

  it("uses the approved five-slot mobile navigation", () => {
    expect([
      ...mobilePrimaryItemsForRole("OWNER").map((item) => item.mobileLabel),
      "More",
    ]).toEqual(["Today", "Inbox", "Front Desk", "Leads", "More"]);
  });

  it.each([
    ["/dashboard", "today"],
    ["/inbox/thread-1", "inbox"],
    ["/contacts?new=1", "leads"],
    ["/agent/questionnaire", "front-desk"],
    ["/templates", "campaigns"],
    ["/automations", "followups"],
    ["/integrations", "integrations"],
    ["/analytics?range=30d", "analytics"],
    ["/settings/voice", "settings"],
  ])("maps %s to the correct active item", (pathname, key) => {
    expect(activeNavKey(pathname)).toBe(key);
  });

  it("returns null for routes outside the authenticated navigation", () => {
    expect(activeNavKey("/onboarding")).toBeNull();
  });
});
