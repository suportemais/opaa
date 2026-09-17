export type RateLimitDecision = {
  allowed: boolean;
  retryAfterSeconds: number;
};

/**
 * In-process sliding window. Enough for a single API replica; MM still
 * cannot enumerate the 7-digit space without HMAC.
 */
export class SlidingWindowRateLimiter {
  private readonly hits = new Map<string, number[]>();

  tryConsume(
    key: string,
    limit: number,
    windowMs: number,
    now = Date.now(),
  ): RateLimitDecision {
    const safeLimit = Math.max(1, Math.floor(limit));
    const safeWindow = Math.max(1_000, Math.floor(windowMs));
    const cutoff = now - safeWindow;
    const prev = (this.hits.get(key) ?? []).filter((ts) => ts > cutoff);
    if (prev.length >= safeLimit) {
      this.hits.set(key, prev);
      const oldest = prev[0] ?? now;
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((oldest + safeWindow - now) / 1000),
      );
      return { allowed: false, retryAfterSeconds };
    }
    prev.push(now);
    this.hits.set(key, prev);
    if (this.hits.size > 10_000) this.prune(cutoff);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  private prune(cutoff: number) {
    for (const [key, times] of this.hits) {
      const next = times.filter((ts) => ts > cutoff);
      if (next.length === 0) this.hits.delete(key);
      else this.hits.set(key, next);
    }
  }
}

export function parsePositiveInt(
  raw: string | undefined,
  fallback: number,
): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}
