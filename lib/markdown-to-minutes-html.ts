/**
 * Escapes text and wraps blocks in <p> for safe insertion into minutes HTML.
 * Double newlines become paragraph breaks; single newlines become <br/>.
 */
export function plainTextOrMarkdownToMinutesHtmlFragment(input: string): string {
  const normalized = input.replace(/\r\n/g, "\n").trim();
  if (!normalized) return "";

  const escape = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const blocks = normalized.split(/\n{2,}/);
  return blocks
    .map((block) => {
      const inner = escape(block).replace(/\n/g, "<br/>");
      return `<p>${inner}</p>`;
    })
    .join("");
}
