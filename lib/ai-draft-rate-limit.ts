const buckets = new Map<string, number[]>();

/**
 * Fixed-window rate limit. Returns true if the request is allowed.
 */
export function consumeRateLimit(
  key: string,
  maxEvents: number,
  windowMs: number,
  now: number = Date.now(),
): boolean {
  const prev = buckets.get(key) ?? [];
  const kept = prev.filter((t) => now - t < windowMs);
  if (kept.length >= maxEvents) {
    buckets.set(key, kept);
    return false;
  }
  kept.push(now);
  buckets.set(key, kept);
  return true;
}

export function draftMinutesRateLimitKey(tenantId: string, userId: string): string {
  return `${tenantId}:${userId}`;
}

/** Clears in-memory buckets (for Vitest isolation). */
export function resetDraftRateLimitBucketsForTests() {
  buckets.clear();
}
