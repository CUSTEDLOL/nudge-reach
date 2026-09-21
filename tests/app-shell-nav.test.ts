import { readFileSync } from "node:fs";
import { BookOpen, Inbox } from "lucide-react";
import { describe, expect, it } from "vitest";
import {
  activeNavChildKey,
  activeNavKey,
  commandsForRole,
  commandsForMode,
  isNavItemActive,
  mobilePrimaryItemsForRole,
  mobilePrimaryItemsForMode,
  navGroupsForRole,
  navItemsForMode,
} from "@/components/features/app-shell/nav";
import {
  bottomNavGridClass,
  isThreadRoute,
} from "@/components/features/app-shell/bottom-nav";

describe("adaptive app navigation", () => {
  it("gives acquisition trials exactly two honest destinations", () => {
    const items = navItemsForMode("trial", "OWNER");

    expect(items.map((item) => [item.label, item.href])).toEqual([
      ["Inbox", "/dashboard"],
      ["Train AI", "/agent"],
    ]);
    expect(items.map((item) => item.icon)).toEqual([Inbox, BookOpen]);
    expect(isNavItemActive("/dashboard", items[0])).toBe(true);
    expect(isNavItemActive("/agent", items[1])).toBe(true);
    expect(mobilePrimaryItemsForMode("trial", "OWNER").map((item) => item.href)).toEqual([
      "/dashboard",
      "/agent",
    ]);
    expect(commandsForMode("trial", "OWNER").map((command) => [command.label, command.href])).toEqual([
      ["Inbox", "/dashboard"],
      ["Train AI", "/agent"],
    ]);
  });

  it("uses a real two-column grid for the two trial destinations", () => {
    expect(bottomNavGridClass(2)).toBe("grid-cols-2");
  });

  it("keeps standard role navigation unchanged", () => {
    expect(navItemsForMode("standard", "OWNER")).toEqual(
      navGroupsForRole("OWNER").flatMap((group) => [...group.items]),
    );
    expect(commandsForMode("standard", "AGENT")).toEqual(commandsForRole("AGENT"));
  });

  it("puts owner destinations in the approved stable group order", () => {
    expect(
      navGroupsForRole("OWNER").map((group) => [
        group.label,
        group.items.map((item) => item.label),
      ])
    ).toEqual([
      ["Workspace", ["Home", "Inbox", "Bookings", "Leads"]],
      [
        "Automation",
        ["AI Front Desk", "Follow-ups", "Campaigns", "Templates"],
      ],
      ["Insights", ["Analytics"]],
      ["Manage", ["Apps", "Settings"]],
    ]);
  });

  it("keeps the agent workspace focused on destinations the role can use", () => {
    const keys = navGroupsForRole("AGENT").flatMap((group) =>
      group.items.map((item) => item.key)
    );

    expect(keys).toEqual([
      "today",
      "inbox",
      "bookings",
      "leads",
      "front-desk",
      "campaigns",
      // Agents compose from approved templates in the inbox, so they can read
      // the library even though they can't build automations.
      "templates",
    ]);
  });

  it("uses the approved five-slot mobile navigation", () => {
    expect([
      ...mobilePrimaryItemsForRole("OWNER").map((item) => item.mobileLabel),
      "More",
    ]).toEqual(["Home", "Inbox", "Front Desk", "Leads", "More"]);
  });

  it.each([
    ["/dashboard", "today"],
    ["/inbox/thread-1", "inbox"],
    ["/bookings?view=past", "bookings"],
    ["/contacts?new=1", "leads"],
    ["/agent/questionnaire", "front-desk"],
    // Templates are shared by campaigns, follow-ups and inbox replies, so they
    // light up their own item rather than whichever section linked in.
    ["/templates", "templates"],
    ["/automations", "followups"],
    ["/integrations", "integrations"],
    ["/analytics?range=30d", "analytics"],
    // Voice and Actions are part of the AI employee, not account admin — they
    // must light up the Front Desk, not Settings.
    ["/agent/voice", "front-desk"],
    ["/agent/actions", "front-desk"],
    ["/settings/billing", "settings"],
  ])("maps %s to the correct active item", (pathname, key) => {
    expect(activeNavKey(pathname)).toBe(key);
  });

  it("gives the AI Front Desk every page that configures the employee", () => {
    const frontDesk = navGroupsForRole("OWNER")
      .flatMap((group) => group.items)
      .find((item) => item.key === "front-desk")!;

    expect(frontDesk.children?.map((child) => [child.label, child.href])).toEqual([
      ["Training", "/agent"],
      ["Setup", "/agent/setup"],
      ["Voice", "/agent/voice"],
      ["Actions", "/agent/actions"],
    ]);
  });

  it.each([
    ["/agent", "training"],
    ["/agent/questionnaire", "training"],
    ["/knowledge", "training"],
    ["/agent/setup", "setup"],
    // The longest match has to win, or Training's /agent would swallow these.
    ["/agent/voice", "voice"],
    ["/agent/actions", "actions"],
    ["/dashboard", null],
  ])("highlights the right sub-page for %s", (pathname, key) => {
    const frontDesk = navGroupsForRole("OWNER")
      .flatMap((group) => group.items)
      .find((item) => item.key === "front-desk")!;

    expect(activeNavChildKey(frontDesk, pathname)).toBe(key);
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
      ["Connect an app", "/integrations"],
    ]);
  });

  it("does not offer admin-only commands to agents", () => {
    expect(commandsForRole("AGENT").map((command) => command.href)).not.toContain(
      "/integrations"
    );
  });

  it("leaves the Front Desk sub-pages open in the rail at all times", () => {
    // Gating them on `active` meant you could not see Voice until you were
    // already inside the section — the hunt the founder complained about.
    const source = readFileSync(
      "src/components/features/app-shell/sidebar.tsx",
      "utf8"
    );

    expect(source).toContain("{!collapsed && item.children && (");
    expect(source).not.toContain("active && item.children");
  });

  it("keeps the mobile bar away from an open inbox thread", () => {
    expect(isThreadRoute("/inbox/thread-1")).toBe(true);
    expect(isThreadRoute("/inbox/try")).toBe(true);
    expect(isThreadRoute("/inbox")).toBe(false);
  });
});
