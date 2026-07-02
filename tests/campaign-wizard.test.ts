import { describe, expect, it } from "vitest";
import {
  blankCampaignContent,
  leadStageLabel,
  parseScheduledAt,
  segmentAudienceName,
  sourceLabel,
} from "@/app/(app)/campaigns/wizard-helpers";
import { campaignContentSchema } from "@/lib/campaign/schema";

describe("blankCampaignContent", () => {
  it("produces schema-valid content with compliant defaults", () => {
    const content = blankCampaignContent();
    expect(campaignContentSchema.safeParse(content).success).toBe(true);
    // Opt-out footer is mandatory (rule 2 — compliance is invisible).
    expect(content.footer).toMatch(/stop/i);
    // Exactly one {{1}} personalization variable.
    expect(content.body.match(/\{\{1\}\}/g)).toHaveLength(1);
  });

  it("uses the given name as productName", () => {
    expect(blankCampaignContent("Diwali Sale").productName).toBe("Diwali Sale");
    expect(blankCampaignContent("  ").productName).toBe("Untitled broadcast");
    expect(blankCampaignContent().productName).toBe("Untitled broadcast");
  });
});

describe("segmentAudienceName", () => {
  it("joins stage, tag and source with friendly labels", () => {
    expect(
      segmentAudienceName({
        stage: "QUALIFIED",
        tagName: "Diwali VIPs",
        source: "in_store",
      })
    ).toBe("Segment: Qualified · Diwali VIPs · In store");
  });

  it("skips missing parts", () => {
    expect(segmentAudienceName({ stage: "WON" })).toBe("Segment: Won");
    expect(segmentAudienceName({ source: "whatsapp" })).toBe(
      "Segment: Whatsapp"
    );
  });

  it("falls back when no filters are set", () => {
    expect(segmentAudienceName({})).toBe("Segment: All opted-in");
  });
});

describe("parseScheduledAt (future-only)", () => {
  const now = new Date("2026-07-02T12:00:00.000Z");

  it("accepts a future timestamp", () => {
    const result = parseScheduledAt("2026-07-03T12:00:00.000Z", now);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.date.toISOString()).toBe("2026-07-03T12:00:00.000Z");
    }
  });

  it("rejects past and present timestamps", () => {
    expect(parseScheduledAt("2026-07-01T12:00:00.000Z", now).ok).toBe(false);
    expect(parseScheduledAt("2026-07-02T12:00:00.000Z", now).ok).toBe(false);
  });

  it("rejects empty and invalid input", () => {
    expect(parseScheduledAt("", now).ok).toBe(false);
    expect(parseScheduledAt("not-a-date", now).ok).toBe(false);
  });
});

describe("labels", () => {
  it("maps lead stages to friendly labels", () => {
    expect(leadStageLabel("NEW")).toBe("New");
    expect(leadStageLabel("QUALIFIED")).toBe("Qualified");
    expect(leadStageLabel("UNKNOWN")).toBe("UNKNOWN");
  });

  it("humanizes opt-in sources", () => {
    expect(sourceLabel("in_store")).toBe("In store");
    expect(sourceLabel("csv-import")).toBe("Csv import");
    expect(sourceLabel("website")).toBe("Website");
  });
});
