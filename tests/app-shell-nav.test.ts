import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  activeNavKey,
  commandsForRole,
  mobilePrimaryItemsForRole,
  navGroupsForRole,
  suggestedNavItemsForRole,
} from "@/components/features/app-shell/nav";
import { isThreadRoute } from "@/components/features/app-shell/bottom-nav";

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

  it("offers honest navigation and quick actions in the command menu", () => {
    const commands = commandsForRole("OWNER");

    expect(
      commands.filter((command) => command.group === "Quick actions").map(
        (command) => [command.label, command.href]
      )
    ).toEqual([
      ["Teach your Front Desk", "/agent/questionnaire"],
      ["Try your Front Desk", "/inbox/try"],
      ["Add a lead", "/contacts?new=1"],
      ["Connect an integration", "/integrations"],
    ]);
  });

  it("does not offer admin-only commands to agents", () => {
    expect(commandsForRole("AGENT").map((command) => command.href)).not.toContain(
      "/integrations"
    );
  });

  it("turns onboarding preferences into ordered, role-safe shortcuts", () => {
    expect(
      suggestedNavItemsForRole("OWNER", [
        "followups",
        "inbox",
        "front-desk",
      ]).map((item) => item.key)
    ).toEqual(["followups", "inbox", "front-desk"]);
    expect(
      suggestedNavItemsForRole("AGENT", [
        "settings",
        "inbox",
        "campaigns",
      ]).map((item) => item.key)
    ).toEqual(["inbox", "campaigns"]);
  });

  it("shows shortcut labels instead of requiring icon recognition", () => {
    const source = readFileSync(
      "src/components/features/app-shell/sidebar.tsx",
      "utf8"
    );
    expect(source).toContain('data-suggested-label="true"');
  });

  it("keeps the mobile bar away from an open inbox thread", () => {
    expect(isThreadRoute("/inbox/thread-1")).toBe(true);
    expect(isThreadRoute("/inbox/try")).toBe(true);
    expect(isThreadRoute("/inbox")).toBe(false);
  });
});
