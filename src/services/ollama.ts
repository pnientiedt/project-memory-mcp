import type { OllamaConfig } from "../types.js";

export class OllamaService {
  private config: OllamaConfig;

  constructor(config: OllamaConfig) {
    this.config = config;
  }

  /**
   * Check if Ollama is available (F-70).
   */
  async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(`${this.config.base_url}/api/tags`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Summarize text using Ollama (F-41).
   * Falls back to keyword extraction if Ollama is unavailable (F-72).
   */
  async summarize(text: string, prompt?: string): Promise<string> {
    const available = await this.isAvailable();
    if (!available) {
      if (this.config.fallback_to_keywords) {
        return keywordExtract(text);
      }
      throw new Error("Ollama is not available and fallback is disabled");
    }

    const systemPrompt = prompt || "Summarize the following content concisely in English. Extract key decisions, changes, or insights. Return structured Markdown.";

    try {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        this.config.timeout_seconds * 1000,
      );

      const response = await fetch(`${this.config.base_url}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.config.model,
          prompt: `${systemPrompt}\n\n${text}`,
          stream: true,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        if (this.config.fallback_to_keywords) {
          return keywordExtract(text);
        }
        throw new Error(`Ollama API error: ${response.status}`);
      }

      // Stream response accumulation
      const result = await streamResponse(response);
      return result;
    } catch (err) {
      if (this.config.fallback_to_keywords) {
        return keywordExtract(text);
      }
      throw err;
    }
  }
}

async function streamResponse(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";

  const decoder = new TextDecoder();
  let result = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split("\n")) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line) as { response?: string; done?: boolean };
        if (parsed.response) result += parsed.response;
        if (parsed.done) break;
      } catch {
        // Skip malformed JSON lines
      }
    }
  }

  return result.trim();
}

/**
 * Keyword extraction fallback (F-72) — no LLM required.
 */
export function keywordExtract(text: string): string {
  const words = text
    .toLowerCase()
    .replace(/[^a-zäöüß\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 4);

  const freq = new Map<string, number>();
  for (const word of words) {
    freq.set(word, (freq.get(word) || 0) + 1);
  }

  const keywords = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);

  return `Keywords: ${keywords.join(", ")}`;
}
