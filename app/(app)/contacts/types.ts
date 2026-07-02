import type { LeadStage } from "@prisma/client";
import type { BadgeTone } from "@/components/ui/badge";

/**
 * Serialized shapes passed from the server pages to the client components
 * (dates as ISO strings), plus shared label/tone maps. Pure module — safe to
 * import from both server and client files.
 */

export type TagInfo = {
  id: string;
  name: string;
  color: string;
  contactCount: number;
};

export type MemberOption = {
  userId: string;
  name: string;
};

export type ContactRow = {
  id: string;
  name: string;
  phoneE164: string;
  email: string | null;
  optedIn: boolean;
  optedOutAt: string | null;
  optInSource: string;
  leadStage: LeadStage;
  assignedToUserId: string | null;
  lastContactedAt: string | null;
  createdAt: string;
  tags: { id: string; name: string; color: string }[];
};

export type AudienceRow = {
  id: string;
  name: string;
  memberCount: number;
};

export type NoteRow = {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
};

export type ActivityItem = {
  id: string;
  kind: "message_in" | "message_out" | "campaign";
  title: string;
  body: string;
  status?: string;
  at: string;
};

export type CampaignMessageRow = {
  id: string;
  campaignName: string;
  status: string;
  costMinorUnits: number | null;
  sentAt: string | null;
  createdAt: string;
};

export const STAGES: { value: LeadStage; label: string }[] = [
  { value: "NEW", label: "New" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "QUALIFIED", label: "Qualified" },
  { value: "WON", label: "Won" },
  { value: "LOST", label: "Lost" },
];

export const STAGE_TONE: Record<LeadStage, BadgeTone> = {
  NEW: "neutral",
  CONTACTED: "info",
  QUALIFIED: "brand",
  WON: "success",
  LOST: "danger",
};

export const STAGE_LABEL: Record<LeadStage, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  WON: "Won",
  LOST: "Lost",
};

export const SOURCE_LABEL: Record<string, string> = {
  in_store: "In store",
  whatsapp: "WhatsApp",
  website: "Website",
  csv_import: "CSV import",
  manual: "Manual",
};

export function sourceLabel(source: string): string {
  return SOURCE_LABEL[source] ?? source;
}

export const MESSAGE_STATUS_TONE: Record<string, BadgeTone> = {
  QUEUED: "neutral",
  SENT: "info",
  DELIVERED: "brand",
  READ: "success",
  CLICKED: "success",
  FAILED: "danger",
};

/** Tag colors mirror the TagPill palette (components/ui/tag-pill.tsx). */
export const TAG_COLORS = [
  "emerald",
  "sky",
  "amber",
  "red",
  "violet",
  "pink",
  "blue",
  "neutral",
] as const;

export const TAG_SWATCH: Record<(typeof TAG_COLORS)[number], string> = {
  emerald: "bg-emerald-400",
  sky: "bg-sky-400",
  amber: "bg-amber-400",
  red: "bg-red-400",
  violet: "bg-violet-400",
  pink: "bg-pink-400",
  blue: "bg-blue-400",
  neutral: "bg-neutral-400",
};

// Explicit timezone keeps server (UTC) and client (IST) renders identical —
// no hydration mismatch. Store UTC, render en-IN (spec §1).
export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

/** Paise → "₹12.34" without importing server-only billing/env code. */
export function formatPaise(minorUnits: number): string {
  return `₹${(minorUnits / 100).toFixed(2)}`;
}
