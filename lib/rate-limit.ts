import "server-only";

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * In-memory, per-process, fixed-window rate limiting.
 *
 * Real-world limits, worth being explicit about: this Map lives in one
 * server process, so it resets on every restart or redeploy, and — the
 * important one — is NOT shared across multiple serverless instances or
 * regions. On a platform that spins up several instances (or one per
 * request), an attacker's requests are spread across separate maps that
 * each allow their own 5/10min, so the effective limit is higher than 5.
 * A real fix needs shared external storage (e.g. Redis/Upstash), which
 * this project doesn't have yet. Adequate for a single-user personal app
 * on one long-running server; not a real defense at scale.
 */
const buckets = new Map<string, Bucket>();

export function checkRateLimit(
  key: string,
  { maxAttempts, windowMs }: { maxAttempts: number; windowMs: number },
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (bucket.count >= maxAttempts) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}
