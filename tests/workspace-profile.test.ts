import { describe, expect, it } from "vitest";
import {
  DEFAULT_WORKSPACE_PROFILE,
  deriveWorkspaceDefaults,
  mergeUiPreferences,
  mergeWorkspaceProfile,
  parseUiPreferences,
  parseWorkspaceProfile,
  parseWorkspaceProfilePatch,
} from "@/modules/dashboard/workspace-profile";

describe("workspace profile", () => {
  it("uses safe owner/operator defaults for missing or legacy settings", () => {
    expect(parseWorkspaceProfile(null)).toEqual(DEFAULT_WORKSPACE_PROFILE);
    expect(parseWorkspaceProfile({ workspaceProfile: "old" })).toEqual(
      DEFAULT_WORKSPACE_PROFILE
    );
  });

  it("keeps valid answers and falls back field-by-field", () => {
    expect(
      parseWorkspaceProfile({
        workspaceProfile: {
          role: "manager",
          primaryOutcome: "follow-up",
          journey: "invalid",
          teamShape: "small-team",
          systems: ["whatsapp", "crm", "unknown"],
          guidance: "balanced",
          lastCompletedStep: 4,
        },
      })
    ).toEqual({
      ...DEFAULT_WORKSPACE_PROFILE,
      role: "manager",
      primaryOutcome: "follow-up",
      teamShape: "small-team",
      systems: ["whatsapp", "crm"],
      guidance: "balanced",
      lastCompletedStep: 4,
    });
  });

  it("rejects invalid autosave values before persistence", () => {
    expect(() => parseWorkspaceProfilePatch({ role: "superuser" })).toThrow(
      /role/i
    );
    expect(() =>
      parseWorkspaceProfilePatch({ systems: ["whatsapp", "none"] })
    ).toThrow(/systems/i);
    expect(() =>
      parseWorkspaceProfilePatch({ lastCompletedStep: 99 })
    ).toThrow(/step/i);
  });

  it("merges the namespaced profile without deleting unrelated org settings", () => {
    expect(
      mergeWorkspaceProfile(
        {
          avgOrderValueInr: 2500,
          anotherFlag: true,
          workspaceProfile: { role: "owner", primaryOutcome: "bookings" },
        },
        { primaryOutcome: "payments", lastCompletedStep: 2 }
      )
    ).toMatchObject({
      avgOrderValueInr: 2500,
      anotherFlag: true,
      workspaceProfile: {
        role: "owner",
        primaryOutcome: "payments",
        lastCompletedStep: 2,
      },
    });
  });

  it("always ranks urgent handoffs first while adapting the next priorities", () => {
    const bookings = deriveWorkspaceDefaults({
      ...DEFAULT_WORKSPACE_PROFILE,
      primaryOutcome: "bookings",
    });
    const payments = deriveWorkspaceDefaults({
      ...DEFAULT_WORKSPACE_PROFILE,
      primaryOutcome: "payments",
    });

    expect(bookings.attentionOrder[0]).toBe("handoff");
    expect(payments.attentionOrder[0]).toBe("handoff");
    expect(bookings.attentionOrder.indexOf("booking")).toBeLessThan(
      bookings.attentionOrder.indexOf("payment")
    );
    expect(payments.attentionOrder.indexOf("payment")).toBeLessThan(
      payments.attentionOrder.indexOf("booking")
    );
  });

  it("derives stable shortcuts instead of rearranging main navigation", () => {
    const defaults = deriveWorkspaceDefaults({
      ...DEFAULT_WORKSPACE_PROFILE,
      primaryOutcome: "follow-up",
    });

    expect(defaults.shortcuts).toEqual([
      "followups",
      "inbox",
      "front-desk",
    ]);
  });
});

describe("member UI preferences", () => {
  it("falls back safely and filters unknown shortcut keys", () => {
    expect(parseUiPreferences(null)).toEqual({
      sidebarCollapsed: false,
      pinnedShortcuts: [],
    });
    expect(
      parseUiPreferences({
        sidebarCollapsed: true,
        pinnedShortcuts: ["inbox", "unknown", "followups"],
      })
    ).toEqual({
      sidebarCollapsed: true,
      pinnedShortcuts: ["inbox", "followups"],
    });
  });

  it("merges preferences without retaining arbitrary fields", () => {
    expect(
      mergeUiPreferences(
        { sidebarCollapsed: false, ignored: "value" },
        { sidebarCollapsed: true, pinnedShortcuts: ["front-desk"] }
      )
    ).toEqual({
      sidebarCollapsed: true,
      pinnedShortcuts: ["front-desk"],
    });
  });
});
