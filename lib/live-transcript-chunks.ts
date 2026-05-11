/** Max chars per transcript segment row (matches API zod schema). */
export const TRANSCRIPT_SEGMENT_MAX_CHARS = 8000;

/**
 * Splits long text into chunks ≤ maxLen on whitespace when possible.
 */
export function splitTextForTranscriptSegments(
  text: string,
  maxLen: number = TRANSCRIPT_SEGMENT_MAX_CHARS,
): string[] {
  const t = text.trim();
  if (!t) return [];
  if (t.length <= maxLen) return [t];

  const parts: string[] = [];
  let rest = t;
  while (rest.length > 0) {
    if (rest.length <= maxLen) {
      parts.push(rest.trim());
      break;
    }
    let slice = rest.slice(0, maxLen);
    const lastSpace = slice.lastIndexOf(" ");
    if (lastSpace > maxLen * 0.5) {
      slice = rest.slice(0, lastSpace);
    }
    const piece = slice.trim();
    if (piece) parts.push(piece);
    rest = rest.slice(slice.length).trimStart();
  }
  return parts;
}
