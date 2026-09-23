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
  lockedNavGroupsForMode,
  navGroupsForMode,
  navGroupsForRole,
  navItemsForMode,
} from "@/components/features/app-shell/nav";
import {
  bottomNavGridClass,
  isThreadRoute,
} from "@/components/features/app-shell/bottom-nav";
import { isTrialWorkspacePath } from "@/modules/trial/routes";

describe("adaptive app navigation", () => {
  it("gives acquisition trials exactly two honest destinations", () => {
    const items = navItemsForMode("trial", "OWNER");

    expect(items.map((item) => [item.label, item.href])).toEqual([
      ["Inbox", "/dashboard"],
      ["Train AI", "/agent"],
    ]);
    expect(items.map((item) => item.icon)).toEqual([Inbox, BookOpen]);
    expect(isNavItemActive("/dashboard", items[0])).toBe(true);
    expect(isNavItemActive("/inbox/try", items[0])).toBe(true);
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

  it.each([
    [1, "grid-cols-1"],
    [2, "grid-cols-2"],
    [3, "grid-cols-3"],
    [4, "grid-cols-4"],
    [5, "grid-cols-5"],
    [0, "grid-cols-1"],
    [6, "grid-cols-1"],
  ])("uses an explicit mobile grid for %i destinations", (count, gridClass) => {
    expect(bottomNavGridClass(count)).toBe(gridClass);
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
      ["Voice", "/agent/voice"],
      ["Actions", "/agent/actions"],
    ]);
  });

  it("no longer offers Setup — Training is the only place the AI is configured", () => {
    const frontDesk = navGroupsForRole("OWNER")
      .flatMap((group) => group.items)
      .find((item) => item.key === "front-desk")!;

    expect(frontDesk.children?.some((child) => child.href === "/agent/setup")).toBe(
      false
    );
  });

  it.each([
    ["/agent", "training"],
    ["/agent/questionnaire", "training"],
    ["/knowledge", "training"],
    // The retired page redirects to /agent; on the way there the strip must
    // still light up Training rather than nothing at all.
    ["/agent/setup", "training"],
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
      ["Try it in chat", "/inbox/try"],
      ["Add a lead", "/contacts?new=1"],
      ["Connect an app", "/integrations"],
    ]);
  });

  it("finds the Front Desk sub-pages by search, whatever the rail is doing", () => {
    // The rail draws its second level only while expanded, and the Front Desk
    // tab strip only below `lg`. A collapsed sidebar on a desktop therefore
    // left Voice and Actions reachable by typed URL alone — and the collapse
    // is remembered server-side, so it stayed broken. Search must not depend
    // on the rail's width.
    const hrefs = commandsForRole("OWNER").map((command) => command.href);

    expect(hrefs).toContain("/agent/voice");
    expect(hrefs).toContain("/agent/actions");
    // Training's href IS the parent's, so it must appear once, not twice.
    expect(hrefs.filter((href) => href === "/agent")).toHaveLength(1);
  });

  it("keeps the trial's command menu to routes its guard actually opens", () => {
    // Front Desk is open in the trial and has children, but Voice and Actions
    // are not trial paths — flattening children here would offer a route the
    // server guard bounces straight back to /dashboard.
    const hrefs = commandsForMode("trial", "OWNER").map((c) => c.href);

    expect(hrefs).not.toContain("/agent/voice");
    expect(hrefs).not.toContain("/agent/actions");
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

/**
 * A trial sees the whole product in the rail: two destinations that open,
 * and the rest shown as locked so the value of paying is visible instead of
 * hidden. The locked shelf is presentation only — it must never become a
 * destination anywhere, because the workspace route guard would bounce it.
 */
describe("trial locked shelf", () => {
  const locked = lockedNavGroupsForMode("trial", "OWNER");

  it("shows one Locked group under the two Open destinations", () => {
    expect(locked).toHaveLength(1);
    expect(locked[0].label).toBe("Locked");
    expect(locked[0].locked).toBe(true);
    expect(navGroupsForMode("trial", "OWNER").map((g) => g.label)).toEqual(["Open"]);
  });

  it("locks every standard destination the trial does not already open", () => {
    const openKeys = navItemsForMode("trial", "OWNER").map((item) => item.key);
    const lockedKeys = locked[0].items.map((item) => item.key);

    // /dashboard is the trial's Inbox and /agent is Train AI — never locked
    expect(lockedKeys).not.toContain("today");
    expect(lockedKeys).not.toContain("inbox");
    expect(lockedKeys).not.toContain("front-desk");
    expect(lockedKeys).toEqual([
      "bookings",
      "leads",
      "followups",
      "campaigns",
      "templates",
      "analytics",
      "integrations",
      "settings",
    ]);
    // together they account for the whole standard rail
    expect(new Set([...openKeys, ...lockedKeys, "today"]).size).toBe(
      new Set(navGroupsForRole("OWNER").flatMap((g) => g.items.map((i) => i.key))).size,
    );
  });

  it("never leaks locked items into anything that navigates", () => {
    expect(navItemsForMode("trial", "OWNER").map((i) => i.href)).toEqual([
      "/dashboard",
      "/agent",
    ]);
    expect(commandsForMode("trial", "OWNER").map((c) => c.href)).toEqual([
      "/dashboard",
      "/agent",
    ]);
    expect(mobilePrimaryItemsForMode("trial", "OWNER").map((i) => i.href)).toEqual([
      "/dashboard",
      "/agent",
    ]);
    for (const item of locked[0].items) {
      expect(isTrialWorkspacePath(item.href)).toBe(false);
    }
  });

  it("is a trial-only shelf", () => {
    expect(lockedNavGroupsForMode("standard", "OWNER")).toEqual([]);
    expect(lockedNavGroupsForMode("standard", "AGENT")).toEqual([]);
  });

  it("renders locked rows as buttons, not links", () => {
    const sidebar = readFileSync(
      "src/components/features/app-shell/sidebar.tsx",
      "utf8",
    );
    expect(sidebar).toContain("lockedNavGroupsForMode");
    expect(sidebar).toContain("group.locked");
    expect(sidebar).toContain("setLockedFeature(item.label)");
    expect(sidebar).toContain("UpgradeDialog");
  });
});
