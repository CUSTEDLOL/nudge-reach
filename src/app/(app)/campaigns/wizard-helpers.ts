import { repairAndValidate } from "@/modules/campaign/guardrails";
import type { CampaignContent } from "@/modules/campaign/schema";

/**
 * Pure helpers for the broadcast wizard (spec §M4). No prisma/env imports —
 * safe in client bundles and unit-tested in tests/campaign-wizard.test.ts.
 */

/** LeadStage enum values + friendly labels (kept in sync with the schema). */
export const LEAD_STAGE_OPTIONS = [
  { value: "NEW", label: "New" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "QUALIFIED", label: "Qualified" },
  { value: "WON", label: "Won" },
  { value: "LOST", label: "Lost" },
] as const;

export const LEAD_STAGE_VALUES = LEAD_STAGE_OPTIONS.map((s) => s.value);

export function leadStageLabel(value: string): string {
  return (
    LEAD_STAGE_OPTIONS.find((s) => s.value === value)?.label ?? value
  );
}

/** "in_store" → "In store" — friendly display for opt-in sources. */
export function sourceLabel(source: string): string {
  const words = source.replace(/[_-]+/g, " ").trim();
  if (!words) return source;
  return words[0].toUpperCase() + words.slice(1);
}

/**
 * Name for an Audience materialized from a dynamic segment, e.g.
 * "Segment: Qualified · Diwali VIPs · In store". Falls back to a generic
 * name when no filters are set.
 */
export function segmentAudienceName(parts: {
  stage?: string;
  tagName?: string;
  source?: string;
}): string {
  const bits = [
    parts.stage ? leadStageLabel(parts.stage) : null,
    parts.tagName || null,
    parts.source ? sourceLabel(parts.source) : null,
  ].filter(Boolean);
  return bits.length > 0
    ? `Segment: ${bits.join(" · ")}`
    : "Segment: All opted-in";
}

export type ScheduleParseResult =
  | { ok: true; date: Date }
  | { ok: false; error: string };

/** Future-only schedule validation (shared by wizard + run panel actions). */
export function parseScheduledAt(
  iso: string,
  now: Date = new Date()
): ScheduleParseResult {
  if (!iso.trim()) {
    return { ok: false, error: "Pick a date and time to schedule." };
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return { ok: false, error: "That date doesn't look right — pick again." };
  }
  if (date.getTime() <= now.getTime()) {
    return { ok: false, error: "Pick a time in the future." };
  }
  return { ok: true, date };
}

/**
 * "Blank" wizard content: an empty-but-compliant §7 shape. Runs through
 * repairAndValidate so the opt-out footer and the single {{1}}
 * personalization variable are guaranteed, same as generated content.
 */
export function blankCampaignContent(name?: string): CampaignContent {
  return repairAndValidate({
    productName: name?.trim() || "Untitled broadcast",
    campaignAngle: "",
    header: "A little something from our shop",
    body: "Hi {{1}}! We have something special for you this week — reply here or visit us to grab it before it's gone.",
    footer: "",
    buttons: [],
    sampleName: "Priya",
    imageTreatment: "",
    notes: "",
  });
}
