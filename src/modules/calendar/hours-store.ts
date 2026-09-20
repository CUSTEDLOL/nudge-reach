import type { Prisma } from "@prisma/client";
import { parseOpeningHours, type OpeningHours } from "@/modules/calendar/hours";

/**
 * Opening hours live in Org.settings (free-form JSON, already there) under
 * one key — no schema change, and they belong to the business rather than
 * to the AI persona. These two helpers are the only readers and writers.
 */
export const OPENING_HOURS_KEY = "openingHours";

export function readOpeningHours(settings: unknown): OpeningHours | null {
  if (!settings || typeof settings !== "object") return null;
  return parseOpeningHours((settings as Record<string, unknown>)[OPENING_HOURS_KEY]);
}

export function settingsWithOpeningHours(
  settings: unknown,
  hours: OpeningHours | null
): Prisma.InputJsonObject {
  const base =
    settings && typeof settings === "object" && !Array.isArray(settings)
      ? { ...(settings as Record<string, unknown>) }
      : {};
  if (hours) base[OPENING_HOURS_KEY] = hours;
  else delete base[OPENING_HOURS_KEY];
  return base as Prisma.InputJsonObject;
}
