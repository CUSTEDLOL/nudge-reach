/**
 * In-process sliding-window rate limiter for abuse-prone endpoints (public
 * lead capture, AI drafting, outbound test requests).
 *
 * Honest scope: state lives in module memory, so on serverless each warm
 * instance enforces independently — this is best-effort abuse damping, not a
 * hard global quota (documented in docs/SECURITY.md). Fluid Compute reuses
 * instances, so in practice it catches exactly the tight-loop abuse it's for.
 */

interface Bucket {
  /** Timestamps (ms) of accepted hits inside the current window. */
  hits: number[];
}

const buckets = new Map<string, Bucket>();

/** Periodically trimmed so long-lived instances don't accumulate stale keys. */
const MAX_KEYS = 10_000;

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the oldest hit leaves the window (when blocked). */
  retryAfterSeconds: number;
}

export function checkRateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
  now: number = Date.now()
): RateLimitResult {
  const cutoff = now - windowMs;
  let bucket = buckets.get(key);
  if (!bucket) {
    if (buckets.size >= MAX_KEYS) {
      // Drop the oldest-inserted key (Map preserves insertion order).
      const first = buckets.keys().next().value;
      if (first !== undefined) buckets.delete(first);
    }
    bucket = { hits: [] };
    buckets.set(key, bucket);
  }

  bucket.hits = bucket.hits.filter((t) => t > cutoff);

  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0];
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
    };
  }

  bucket.hits.push(now);
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Test hook: wipe all buckets. */
export function resetRateLimits(): void {
  buckets.clear();
}

/** Presets, so call sites stay declarative. */
export const RATE_LIMITS = {
  /** Public waitlist/demo form — per IP. */
  publicForm: { limit: 5, windowMs: 60_000 },
  /** AI draft suggestions — per org. */
  aiSuggest: { limit: 20, windowMs: 60_000 },
  /** Outbound test deliveries (webhook ping, Meta test call) — per org. */
  outboundTest: { limit: 10, windowMs: 60_000 },
} as const;
