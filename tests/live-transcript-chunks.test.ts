import { describe, expect, it } from "vitest";

import {
  splitTextForTranscriptSegments,
  TRANSCRIPT_SEGMENT_MAX_CHARS,
} from "@/lib/live-transcript-chunks";

describe("splitTextForTranscriptSegments", () => {
  it("returns empty for blank input", () => {
    expect(splitTextForTranscriptSegments("   ")).toEqual([]);
  });

  it("keeps short text as one chunk", () => {
    expect(splitTextForTranscriptSegments("hello world")).toEqual(["hello world"]);
  });

  it("splits long text into chunks at most maxLen", () => {
    const word = "word ";
    const n = Math.ceil((TRANSCRIPT_SEGMENT_MAX_CHARS + 500) / word.length);
    const long = word.repeat(n).trimEnd();
    const parts = splitTextForTranscriptSegments(long);
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) {
      expect(p.length).toBeLessThanOrEqual(TRANSCRIPT_SEGMENT_MAX_CHARS);
    }
    expect(parts.join(" ").replace(/\s+/g, " ").trim()).toBe(long.replace(/\s+/g, " ").trim());
  });
});
