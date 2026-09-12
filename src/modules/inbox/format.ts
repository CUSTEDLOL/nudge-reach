/**
 * Pure, client-safe formatting helpers for the inbox (relative times, day
 * separators, the 24h service-window countdown). No server imports.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const SERVICE_WINDOW_MS = DAY;

/** Compact relative time for the conversation list: "now", "5m", "3h", "2d". */
export function formatRelativeTime(iso: string | null, now = Date.now()): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const diff = Math.max(0, now - then);
  if (diff < MINUTE) return "now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d`;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

/** "Today" / "Yesterday" / "28 Jun 2026" for thread day separators. */
export function formatDayLabel(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(now) - startOfDay(date)) / DAY);
  if (dayDiff === 0) return "Today";
  if (dayDiff === 1) return "Yesterday";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

/** Calendar-day key used to group messages under one separator. */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** "10:42 am" bubble timestamp. */
export function formatMessageTime(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export interface WindowState {
  open: boolean;
  /** e.g. "23h 12m left" while open; null when closed / never opened. */
  label: string | null;
}

/**
 * State of the WhatsApp 24-hour customer-service window. Mirrors
 * lib/agent/window.ts semantics; duplicated here so client components don't
 * pull server code.
 */
export function serviceWindowState(
  lastInboundAtIso: string | null,
  now = Date.now()
): WindowState {
  if (!lastInboundAtIso) return { open: false, label: null };
  const remaining =
    new Date(lastInboundAtIso).getTime() + SERVICE_WINDOW_MS - now;
  if (remaining <= 0) return { open: false, label: null };
  const hours = Math.floor(remaining / HOUR);
  const minutes = Math.floor((remaining % HOUR) / MINUTE);
  return {
    open: true,
    label: hours > 0 ? `${hours}h ${minutes}m left` : `${minutes}m left`,
  };
}

/** First name for {{1}} personalisation (matches the campaign queue's rule). */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/**
 * Truncate a message body for Conversation.lastMessagePreview. Truncation is
 * code-point-safe and lone surrogates are stripped — a preview must never
 * split an emoji in half (Postgres rejects unpaired surrogates).
 */
export function toPreview(body: string): string {
  const flat = body
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const points = [...flat];
  return points.length > 120 ? `${points.slice(0, 119).join("")}…` : flat;
}

/* ------------------------------------------------------------------ */
/* WhatsApp text formatting                                            */
/* ------------------------------------------------------------------ */

/**
 * The model sometimes writes Markdown; WhatsApp bolds with SINGLE asterisks
 * and knows nothing about ## headings. Normalize agent output before it is
 * stored or sent so customers never see literal "**".
 */
export function normalizeWhatsAppMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "*$1*")
    .replace(/__(.+?)__/g, "_$1_")
    .replace(/^#{1,6}\s+/gm, "");
}

export interface WhatsAppSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
}

const MARK_RE = /([*_])(\S(?:[^*_\n]*?\S)?)\1/g;

/**
 * Split a message into renderable segments: WhatsApp-style *bold* and
 * _italic_ runs become styled segments; everything ambiguous (unbalanced
 * marks, "5 * 3") stays literal. Conservative by design — a false plain
 * string beats mangled text.
 */
export function whatsAppSegments(body: string): WhatsAppSegment[] {
  const segments: WhatsAppSegment[] = [];
  let last = 0;
  for (const match of body.matchAll(MARK_RE)) {
    const index = match.index ?? 0;
    // Marks glued to surrounding word characters ("15 *fun" edge) are risky;
    // require the mark to start a run cleanly (start-of-text or whitespace).
    if (index > 0 && !/\s/.test(body[index - 1])) continue;
    if (index > last) segments.push({ text: body.slice(last, index) });
    segments.push({
      text: match[2],
      ...(match[1] === "*" ? { bold: true } : { italic: true }),
    });
    last = index + match[0].length;
  }
  if (last < body.length) segments.push({ text: body.slice(last) });
  return segments;
}
