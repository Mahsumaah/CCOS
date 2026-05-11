import type { OpenRouterChatMessage } from "@/lib/openrouter";

/** Max characters sent to the model (rough context budget for free models). */
export const TRANSCRIPT_DRAFT_CHAR_BUDGET = 14_000;

export function buildTranscriptDraftMessages(params: {
  meetingTitle: string;
  locale: "ar" | "en";
  transcriptText: string;
}): OpenRouterChatMessage[] {
  const lang =
    params.locale === "ar"
      ? "Modern Standard Arabic. Use professional board-meeting register."
      : "English. Use clear, professional board-meeting language.";

  const system = [
    "You are an assistant helping a board secretary turn a live meeting transcript into a draft minutes outline.",
    `Write the entire response in ${lang}`,
    "Rules:",
    "- Stay faithful to the transcript; do not invent votes, decisions, or attendance not supported by the text.",
    "- If something is unclear, write [unclear] instead of guessing.",
    "- Use markdown headings (##) for sections.",
    "- Suggested sections: Overview, Discussion summary, Points raised, Decisions or motions (only if explicitly stated), Action items, Open items.",
    "- Keep the draft concise and suitable for human review before official adoption.",
  ].join("\n");

  const user = [
    `Meeting title: ${params.meetingTitle}`,
    "",
    "Transcript (may be truncated):",
    "",
    params.transcriptText,
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

export function segmentsToPlainText(
  segments: Array<{
    text: string;
    speakerName: string | null;
    createdAt: Date;
  }>,
): string {
  const lines: string[] = [];
  for (const s of segments) {
    const who = s.speakerName?.trim() || "Speaker";
    const ts = s.createdAt.toISOString();
    lines.push(`[${ts}] ${who}: ${s.text.trim()}`);
  }
  return lines.join("\n");
}

export function truncateTranscriptForModel(text: string, maxChars: number): {
  text: string;
  truncated: boolean;
} {
  if (text.length <= maxChars) {
    return { text, truncated: false };
  }
  return {
    text: text.slice(-maxChars),
    truncated: true,
  };
}
