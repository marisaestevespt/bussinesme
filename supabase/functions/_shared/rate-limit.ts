/**
 * In-memory rate limiter for Supabase Edge Functions.
 *
 * Limitations:
 * - State lives in the current isolate. Cold starts reset counters.
 * - Not shared across concurrent isolates (each instance has its own counters).
 * - Sufficient as a first line of defense against trivial abuse, brute-force
 *   bursts and accidental flooding. NOT a replacement for proper IP/user
 *   throttling at the edge (Cloudflare, etc.).
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Periodic cleanup to prevent unbounded memory growth.
let lastCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 60_000;

function cleanup(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSec: number;
}

/**
 * Check if a given key is within the rate limit.
 *
 * @param key Unique identifier (e.g. `"upload:" + ip`)
 * @param limit Max requests allowed within the window
 * @param windowSec Window length in seconds
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowSec: number,
): RateLimitResult {
  const now = Date.now();
  cleanup(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    const resetAt = now + windowSec * 1000;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt, retryAfterSec: 0 };
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: bucket.resetAt,
      retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }

  bucket.count += 1;
  return {
    allowed: true,
    remaining: limit - bucket.count,
    resetAt: bucket.resetAt,
    retryAfterSec: 0,
  };
}

/**
 * Extract a best-effort client identifier from the request.
 * Falls back to "unknown" if nothing usable is present.
 */
export function getClientId(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

/**
 * Build a 429 response with Retry-After + standard rate limit headers.
 */
export function rateLimitResponse(
  result: RateLimitResult,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(
    JSON.stringify({
      error: "Too many requests",
      retryAfterSec: result.retryAfterSec,
    }),
    {
      status: 429,
      headers: {
        ...extraHeaders,
        "Content-Type": "application/json",
        "Retry-After": String(result.retryAfterSec),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.floor(result.resetAt / 1000)),
      },
    },
  );
}