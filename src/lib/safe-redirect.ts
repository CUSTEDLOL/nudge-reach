/**
 * Return `next` only when it is a same-site absolute PATH — it must start with
 * a single "/" and not "//" or "/\" (protocol-relative and backslash tricks
 * that browsers resolve to an external host). Otherwise fall back.
 *
 * Both auth redirect routes build `${origin}${next}` from a user-controlled
 * `next` query param; without this an attacker could bounce a freshly
 * authenticated user to a phishing host.
 */
export function safeRelativePath(
  next: string | null | undefined,
  fallback = "/dashboard"
): string {
  if (
    !next ||
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.startsWith("/\\") ||
    next.startsWith("/%2f") ||
    next.startsWith("/%2F") ||
    next.startsWith("/%5c") ||
    next.startsWith("/%5C")
  ) {
    return fallback;
  }
  return next;
}
