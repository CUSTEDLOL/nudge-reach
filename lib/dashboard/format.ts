/**
 * Display formatting for the dashboard — pure and unit-testable.
 * Dates render en-IN per the repo convention (spec §1).
 */

/** 0.62 → "62%"; null (nothing sent yet) → "—". */
export function formatPercent(rate: number | null): string {
  if (rate === null) return "—";
  return `${Math.round(rate * 100)}%`;
}

/** Indian-style digit grouping: 123456 → "1,23,456". */
export function formatCount(value: number): string {
  return new Intl.NumberFormat("en-IN").format(value);
}

/** Whole-rupee INR: 149900 → "₹1,49,900". */
export function formatInrRupees(rupees: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(rupees);
}

/** Compact relative time for list rows: "just now", "5m ago", "2d ago". */
export function formatRelativeTime(
  date: Date | null | undefined,
  now: Date = new Date()
): string {
  if (!date) return "—";
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 60_000) return "just now";
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
  }).format(date);
}

/** Time-of-day greeting from a 0–23 hour. */
export function greetingForHour(hour: number): string {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}

/** Current hour in India (the audience's timezone), 0–23. */
export function istHour(now: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hour12: false,
      timeZone: "Asia/Kolkata",
    }).format(now)
  );
}
