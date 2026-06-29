export type ClassValue = string | number | null | false | undefined;

/**
 * Minimal classname joiner — filters falsy values and joins with spaces.
 * Deliberately dependency-free; we write Tailwind classes carefully enough
 * that we don't need conflict-resolution (tailwind-merge).
 */
export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}
