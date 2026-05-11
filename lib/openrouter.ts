const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/** Default free-tier model on OpenRouter (override with OPENROUTER_MODEL). */
export const DEFAULT_OPENROUTER_MODEL = "google/gemma-2-9b-it:free";

export function getOpenRouterApiKey(): string | null {
  const k = process.env.OPENROUTER_API_KEY?.trim();
  return k && k.length > 0 ? k : null;
}

export function getOpenRouterModel(): string {
  return process.env.OPENROUTER_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL;
}

export function isOpenRouterConfigured(): boolean {
  return getOpenRouterApiKey() != null;
}

export type OpenRouterChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function openRouterChatCompletion(params: {
  messages: OpenRouterChatMessage[];
  maxTokens?: number;
  temperature?: number;
}): Promise<{ content: string; model: string }> {
  const apiKey = getOpenRouterApiKey();
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  const model = getOpenRouterModel();
  const siteUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.OPENROUTER_HTTP_REFERER?.trim() ||
    "https://localhost";

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": siteUrl,
      "X-Title": "CCOS",
    },
    body: JSON.stringify({
      model,
      messages: params.messages,
      max_tokens: params.maxTokens ?? 2048,
      temperature: params.temperature ?? 0.3,
    }),
  });

  const raw = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
    choices?: Array<{ message?: { content?: string } }>;
  };

  if (!res.ok) {
    const msg = raw.error?.message ?? res.statusText;
    throw new Error(`OpenRouter error ${res.status}: ${msg}`);
  }

  const content = raw.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("OpenRouter returned an empty completion");
  }

  return { content, model };
}
