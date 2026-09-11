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

  it("does not erase later completed answers when an earlier answer changes", () => {
    const settings = mergeWorkspaceProfile(
      {
        workspaceProfile: {
          role: "owner",
          primaryOutcome: "bookings",
          lastCompletedStep: 6,
        },
      },
      { role: "front-desk", lastCompletedStep: 1 }
    );

    expect(settings).toMatchObject({
      workspaceProfile: {
        role: "front-desk",
        primaryOutcome: "bookings",
        lastCompletedStep: 6,
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

  it("uses the customer journey and current systems to order recommendations", () => {
    const defaults = deriveWorkspaceDefaults({
      ...DEFAULT_WORKSPACE_PROFILE,
      primaryOutcome: "payments",
      journey: "quote-follow-up",
      systems: ["google-calendar"],
    });

    expect(defaults.attentionOrder.slice(0, 4)).toEqual([
      "handoff",
      "owner-question",
      "payment",
      "followup",
    ]);
    expect(defaults.setupOrder.slice(0, 4)).toEqual([
      "teach-front-desk",
      "try-front-desk",
      "configure-followups",
      "connect-calendar",
    ]);
  });

  it("turns direct guidance into a concise dashboard without hiding features", () => {
    expect(
      deriveWorkspaceDefaults({
        ...DEFAULT_WORKSPACE_PROFILE,
        guidance: "direct",
      }).showSectionDescriptions
    ).toBe(false);
    expect(
      deriveWorkspaceDefaults({
        ...DEFAULT_WORKSPACE_PROFILE,
        guidance: "guided",
      }).showSectionDescriptions
    ).toBe(true);
  });
});

describe("member UI preferences", () => {
  it("falls back safely and ignores stale keys left by older versions", () => {
    expect(parseUiPreferences(null)).toEqual({ sidebarCollapsed: false });
    expect(
      parseUiPreferences({
        sidebarCollapsed: true,
        pinnedShortcuts: ["inbox", "followups"],
      })
    ).toEqual({ sidebarCollapsed: true });
  });

  it("merges preferences without retaining arbitrary fields", () => {
    expect(
      mergeUiPreferences(
        { sidebarCollapsed: false, ignored: "value" },
        { sidebarCollapsed: true }
      )
    ).toEqual({ sidebarCollapsed: true });
  });
});
