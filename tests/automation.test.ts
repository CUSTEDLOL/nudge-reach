import { describe, expect, it } from "vitest";
import {
  automationMatchesEvent,
  matchesKeyword,
  normalizeLogEntries,
  parseKeywordConfig,
  readWaitMinutes,
  MAX_WAIT_MINUTES,
} from "@/lib/automation/definitions";
import { parseAutomationDraft, validateStepConfig } from "@/lib/automation/draft";

describe("matchesKeyword (spec §M6: keyword trigger matching)", () => {
  const contains = { keywords: ["hours", "kab khulta"], match: "contains" };
  const exact = { keywords: ["stop", "menu"], match: "exact" };

  it("matches when any keyword appears anywhere (contains)", () => {
    expect(matchesKeyword("What are your hours today?", contains)).toBe(true);
    expect(matchesKeyword("shop kab khulta hai?", contains)).toBe(true);
  });

  it("is case-insensitive on both sides", () => {
    expect(matchesKeyword("YOUR HOURS PLEASE", contains)).toBe(true);
    expect(
      matchesKeyword("what time", { keywords: ["TIME"], match: "contains" })
    ).toBe(true);
  });

  it("does not match when no keyword is present", () => {
    expect(matchesKeyword("do you deliver to Andheri?", contains)).toBe(false);
  });

  it("exact mode requires the whole trimmed message to equal a keyword", () => {
    expect(matchesKeyword("menu", exact)).toBe(true);
    expect(matchesKeyword("  MENU  ", exact)).toBe(true);
    expect(matchesKeyword("show me the menu", exact)).toBe(false);
  });

  it("returns false for empty text or empty keyword list", () => {
    expect(matchesKeyword("", contains)).toBe(false);
    expect(matchesKeyword("   ", contains)).toBe(false);
    expect(matchesKeyword("hours", { keywords: [], match: "contains" })).toBe(false);
  });

  it("is defensive against malformed configs", () => {
    expect(matchesKeyword("hours", null)).toBe(false);
    expect(matchesKeyword("hours", {})).toBe(false);
    expect(matchesKeyword("hours", { keywords: "hours" })).toBe(false);
    expect(
      matchesKeyword("hours", { keywords: [42, null, "hours"], match: "contains" })
    ).toBe(true);
  });

  it("defaults unknown match modes to contains", () => {
    expect(
      matchesKeyword("opening hours?", { keywords: ["hours"], match: "fuzzy" })
    ).toBe(true);
  });
});

describe("parseKeywordConfig", () => {
  it("normalizes a valid config", () => {
    expect(parseKeywordConfig({ keywords: ["Hi", " "], match: "exact" })).toEqual({
      keywords: ["Hi"],
      match: "exact",
    });
  });

  it("falls back to empty keywords + contains", () => {
    expect(parseKeywordConfig(undefined)).toEqual({ keywords: [], match: "contains" });
    expect(parseKeywordConfig([1, 2])).toEqual({ keywords: [], match: "contains" });
  });
});

describe("automationMatchesEvent", () => {
  it("rejects a trigger mismatch", () => {
    expect(
      automationMatchesEvent(
        { trigger: "keyword", triggerConfig: { keywords: ["hi"] } },
        "message_received"
      )
    ).toBe(false);
  });

  it("keyword triggers match on the inbound text", () => {
    const automation = {
      trigger: "keyword",
      triggerConfig: { keywords: ["timing"], match: "contains" },
    };
    expect(
      automationMatchesEvent(automation, "keyword", { text: "aaj ki timing?" })
    ).toBe(true);
    expect(automationMatchesEvent(automation, "keyword", { text: "hello" })).toBe(false);
    expect(automationMatchesEvent(automation, "keyword", {})).toBe(false);
  });

  it("tag_added scoped to a tagName only fires for that tag (case-insensitive)", () => {
    const automation = { trigger: "tag_added", triggerConfig: { tagName: "VIP" } };
    expect(automationMatchesEvent(automation, "tag_added", { tagName: "vip" })).toBe(true);
    expect(
      automationMatchesEvent(automation, "tag_added", { tagName: "New customer" })
    ).toBe(false);
  });

  it("tag_added with no configured tag fires for any tag", () => {
    expect(
      automationMatchesEvent(
        { trigger: "tag_added", triggerConfig: {} },
        "tag_added",
        { tagName: "anything" }
      )
    ).toBe(true);
  });

  it("message_received / contact_created / campaign_reply always match their trigger", () => {
    for (const trigger of ["message_received", "contact_created", "campaign_reply"] as const) {
      expect(
        automationMatchesEvent({ trigger, triggerConfig: {} }, trigger)
      ).toBe(true);
    }
  });
});

describe("normalizeLogEntries (run log shape helper)", () => {
  it("passes through the engine shape", () => {
    const entries = normalizeLogEntries([
      { step: 1, kind: "send_message", ok: true, detail: "Sent.", at: "2026-07-01T10:00:00Z" },
    ]);
    expect(entries).toEqual([
      { step: 1, kind: "send_message", ok: true, detail: "Sent.", at: "2026-07-01T10:00:00Z" },
    ]);
  });

  it("accepts the seeded demo shape (status: ok|error)", () => {
    const entries = normalizeLogEntries([
      { step: 1, kind: "send_message", status: "ok", detail: "d", at: "x" },
      { step: 2, kind: "send_message", status: "error", detail: "e", at: "y" },
    ]);
    expect(entries[0].ok).toBe(true);
    expect(entries[1].ok).toBe(false);
  });

  it("returns [] for non-arrays and defaults malformed entries", () => {
    expect(normalizeLogEntries(null)).toEqual([]);
    expect(normalizeLogEntries("log")).toEqual([]);
    const [entry] = normalizeLogEntries([42]);
    expect(entry).toEqual({ step: 1, kind: "unknown", ok: false, detail: "", at: "" });
  });
});

describe("readWaitMinutes", () => {
  it("reads valid minutes and rounds", () => {
    expect(readWaitMinutes({ minutes: 5 })).toBe(5);
    expect(readWaitMinutes({ minutes: "30" })).toBe(30);
    expect(readWaitMinutes({ minutes: 2.6 })).toBe(3);
  });

  it("defaults to 1 and clamps to a week", () => {
    expect(readWaitMinutes({})).toBe(1);
    expect(readWaitMinutes({ minutes: -10 })).toBe(1);
    expect(readWaitMinutes({ minutes: "soon" })).toBe(1);
    expect(readWaitMinutes({ minutes: 10 ** 9 })).toBe(MAX_WAIT_MINUTES);
  });
});

describe("validateStepConfig (builder save validation)", () => {
  it("send_message requires text (accepts legacy body key)", () => {
    expect(validateStepConfig("send_message", {})).toBeTruthy();
    expect(validateStepConfig("send_message", { text: "  " })).toBeTruthy();
    expect(validateStepConfig("send_message", { text: "hi" })).toBeNull();
    expect(validateStepConfig("send_message", { body: "hi" })).toBeNull();
  });

  it("reference steps require their ids", () => {
    expect(validateStepConfig("send_template", {})).toBeTruthy();
    expect(validateStepConfig("send_template", { templateId: "t1" })).toBeNull();
    expect(validateStepConfig("add_tag", { tagId: "" })).toBeTruthy();
    expect(validateStepConfig("add_tag", { tagId: "tag1" })).toBeNull();
    expect(validateStepConfig("assign_agent", {})).toBeTruthy();
    expect(validateStepConfig("assign_agent", { userId: "u1" })).toBeNull();
  });

  it("update_lead_stage requires a valid stage", () => {
    expect(validateStepConfig("update_lead_stage", { stage: "HOT" })).toBeTruthy();
    expect(validateStepConfig("update_lead_stage", { stage: "QUALIFIED" })).toBeNull();
  });

  it("wait requires minutes >= 1; status steps need nothing", () => {
    expect(validateStepConfig("wait", { minutes: 0 })).toBeTruthy();
    expect(validateStepConfig("wait", { minutes: "nope" })).toBeTruthy();
    expect(validateStepConfig("wait", { minutes: 10 })).toBeNull();
    expect(validateStepConfig("resolve_conversation", {})).toBeNull();
    expect(validateStepConfig("handoff_to_human", {})).toBeNull();
  });
});

describe("parseAutomationDraft", () => {
  const base = {
    name: "Store hours FAQ",
    description: "",
    enabled: true,
    trigger: "keyword",
    triggerConfig: { keywords: ["hours"], match: "contains" },
    steps: [{ kind: "send_message", config: { text: "We open at 10:30" } }],
  };

  it("accepts a complete draft", () => {
    const result = parseAutomationDraft(base);
    expect(result.ok).toBe(true);
  });

  it("requires a name and at least one step", () => {
    expect(parseAutomationDraft({ ...base, name: "  " }).ok).toBe(false);
    expect(parseAutomationDraft({ ...base, steps: [] }).ok).toBe(false);
  });

  it("keyword trigger requires keywords and normalizes the config", () => {
    const noKeywords = parseAutomationDraft({ ...base, triggerConfig: {} });
    expect(noKeywords.ok).toBe(false);

    const messy = parseAutomationDraft({
      ...base,
      triggerConfig: { keywords: ["hi", "", 42], match: "weird", extra: true },
    });
    expect(messy.ok).toBe(true);
    if (messy.ok) {
      expect(messy.draft.triggerConfig).toEqual({ keywords: ["hi"], match: "contains" });
    }
  });

  it("surfaces the failing step number and label", () => {
    const result = parseAutomationDraft({
      ...base,
      steps: [
        { kind: "send_message", config: { text: "ok" } },
        { kind: "add_tag", config: {} },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Step 2");
      expect(result.error).toContain("Add tag");
    }
  });

  it("rejects unknown triggers and step kinds", () => {
    expect(parseAutomationDraft({ ...base, trigger: "webhook" }).ok).toBe(false);
    expect(
      parseAutomationDraft({ ...base, steps: [{ kind: "explode", config: {} }] }).ok
    ).toBe(false);
  });
});
