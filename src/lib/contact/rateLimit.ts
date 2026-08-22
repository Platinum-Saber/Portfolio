/**
 * A rate limiter with an honest description of what it is.
 *
 * This is an in-memory sliding window living inside one serverless instance.
 * Vercel runs several concurrently and recycles them freely, so a determined
 * attacker gets N times the quota and a cold start resets it entirely. It is
 * not a security control. It is a cheap stop on the ordinary case — a stuck
 * retry loop, someone leaning on the submit button, a crawler that found the
 * endpoint — and it costs nothing, which is the whole constraint here.
 *
 * The real backstop is that the endpoint can only append rows to one table it
 * cannot read. The upgrade path, if this ever matters, is in
 * `docs/PHASE-5-SUPABASE.md`.
 */

type Window = { count: number; resetAt: number };

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 3;

const buckets = new Map<string, Window>();

/** Keeps the map from growing without bound on a long-lived instance. */
function sweep(now: number): void {
  if (buckets.size < 500) return;
  for (const [key, window] of buckets) {
    if (window.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = {
  allowed: boolean;
  /** Seconds until the caller may try again. Zero when allowed. */
  retryAfter: number;
};

export function checkRateLimit(key: string, now = Date.now()): RateLimitResult {
  sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }

  if (existing.count >= MAX_PER_WINDOW) {
    return {
      allowed: false,
      retryAfter: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  existing.count += 1;
  return { allowed: true, retryAfter: 0 };
}

/** Exposed for tests; nothing in the app should need to call this. */
export function resetRateLimits(): void {
  buckets.clear();
}

/**
 * Identifies a caller without ever holding their IP address. The hash is
 * per-process and unsalted-by-design — it exists to bucket requests for ten
 * minutes, not to be stored, logged or correlated with anything.
 */
export async function callerKey(request: Request): Promise<string> {
  const forwarded = request.headers.get('x-forwarded-for') ?? '';
  const ip = forwarded.split(',')[0]?.trim() || 'unknown';
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(ip),
  );
  return Array.from(new Uint8Array(digest).slice(0, 8))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
