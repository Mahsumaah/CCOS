import { describe, expect, it } from "vitest";

import { consumeRateLimit, resetDraftRateLimitBucketsForTests } from "@/lib/ai-draft-rate-limit";

describe("consumeRateLimit", () => {
  it("allows up to maxEvents within the window", () => {
    resetDraftRateLimitBucketsForTests();
    const key = "t:test-window";
    const t0 = 1_000_000;
    expect(consumeRateLimit(key, 3, 10_000, t0)).toBe(true);
    expect(consumeRateLimit(key, 3, 10_000, t0 + 1000)).toBe(true);
    expect(consumeRateLimit(key, 3, 10_000, t0 + 2000)).toBe(true);
    expect(consumeRateLimit(key, 3, 10_000, t0 + 3000)).toBe(false);
  });

  it("drops timestamps outside the window", () => {
    resetDraftRateLimitBucketsForTests();
    const key = "t:test-expiry";
    const t0 = 1_000_000;
    expect(consumeRateLimit(key, 2, 1000, t0)).toBe(true);
    expect(consumeRateLimit(key, 2, 1000, t0 + 500)).toBe(true);
    expect(consumeRateLimit(key, 2, 1000, t0 + 2000)).toBe(true);
  });
});
