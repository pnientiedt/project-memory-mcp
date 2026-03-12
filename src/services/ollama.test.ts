import { describe, it, expect, vi, afterEach } from "vitest";
import { keywordExtract } from "./ollama.js";
import type { OllamaConfig } from "../types.js";

// Mock fetch for Ollama HTTP tests
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

async function makeService(config?: Partial<OllamaConfig>) {
  const { OllamaService } = await import("./ollama.js");
  return new OllamaService({
    base_url: "http://localhost:11434",
    model: "llama3.2",
    timeout_seconds: 5,
    fallback_to_keywords: true,
    ...config,
  });
}

describe("OllamaService", () => {
  afterEach(() => {
    mockFetch.mockReset();
    vi.resetModules();
  });

  describe("isAvailable()", () => {
    it("returns true when /api/tags responds with 200", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });
      const service = await makeService();
      expect(await service.isAvailable()).toBe(true);
    });

    it("returns false when /api/tags responds with non-200", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
      const service = await makeService();
      expect(await service.isAvailable()).toBe(false);
    });

    it("returns false when fetch throws (not reachable)", async () => {
      mockFetch.mockRejectedValueOnce(new Error("connection refused"));
      const service = await makeService();
      expect(await service.isAvailable()).toBe(false);
    });
  });

  describe("summarize() with fallback", () => {
    it("falls back to keyword extraction when Ollama is not available", async () => {
      // isAvailable check fails
      mockFetch.mockRejectedValueOnce(new Error("not available"));
      const service = await makeService({ fallback_to_keywords: true });
      const result = await service.summarize("authentication refactoring module pattern");
      expect(result).toContain("Keywords:");
    });

    it("throws when Ollama not available and fallback disabled", async () => {
      mockFetch.mockRejectedValueOnce(new Error("not available"));
      const service = await makeService({ fallback_to_keywords: false });
      await expect(service.summarize("text")).rejects.toThrow();
    });

    it("falls back on Ollama API error", async () => {
      // isAvailable succeeds, generate fails
      mockFetch
        .mockResolvedValueOnce({ ok: true }) // isAvailable
        .mockResolvedValueOnce({ ok: false, status: 500 }); // generate
      const service = await makeService({ fallback_to_keywords: true });
      const result = await service.summarize("some text with words");
      expect(result).toContain("Keywords:");
    });
  });

  describe("streaming response", () => {
    it("accumulates streamed response chunks", async () => {
      const streamChunks = [
        JSON.stringify({ response: "Hello " }),
        JSON.stringify({ response: "World" }),
        JSON.stringify({ response: "!", done: true }),
      ].join("\n");

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(streamChunks));
          controller.close();
        },
      });

      mockFetch
        .mockResolvedValueOnce({ ok: true }) // isAvailable
        .mockResolvedValueOnce({ ok: true, body: stream }); // generate

      const service = await makeService();
      const result = await service.summarize("test text");
      expect(result).toBe("Hello World!");
    });
  });
});

describe("keywordExtract()", () => {
  it("returns keywords from text", () => {
    const result = keywordExtract("authentication refactoring authentication module authentication pattern");
    expect(result).toContain("Keywords:");
    expect(result).toContain("authentication");
  });

  it("handles empty text", () => {
    const result = keywordExtract("");
    expect(result).toContain("Keywords:");
  });

  it("filters short words", () => {
    const result = keywordExtract("I am a the it authentication");
    // Short words (< 5 chars) should not appear
    expect(result).not.toMatch(/\b(I|am|a|the|it)\b/);
  });
});
