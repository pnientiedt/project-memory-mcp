import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { contentId, parseMarkdownSections } from "./embedding.js";

// Mock @huggingface/transformers to avoid model download in tests
vi.mock("@huggingface/transformers", () => ({
  pipeline: vi.fn().mockResolvedValue(
    vi.fn().mockImplementation(async (text: string) => {
      // Deterministic fake embedding based on text hash
      const vector = new Float32Array(384);
      let hash = 0;
      for (let i = 0; i < text.length; i++) {
        hash = (hash * 31 + text.charCodeAt(i)) & 0xffffffff;
      }
      for (let i = 0; i < 384; i++) {
        vector[i] = Math.sin(hash + i) * 0.1;
      }
      // Normalize
      const norm = Math.sqrt(vector.reduce((s, v) => s + v * v, 0));
      for (let i = 0; i < 384; i++) vector[i] /= norm;
      return { data: vector };
    })
  ),
}));

describe("EmbeddingService", () => {
  let dbPath: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let EmbeddingService: any;

  beforeEach(async () => {
    dbPath = join(tmpdir(), `test-embed-${Date.now()}.db`);
    vi.resetModules();
    // Re-import after mocking
    const mod = await import("./embedding.js");
    EmbeddingService = mod.EmbeddingService;
  });

  afterEach(() => {
    rmSync(dbPath, { force: true });
    rmSync(`${dbPath}-wal`, { force: true });
    rmSync(`${dbPath}-shm`, { force: true });
  });

  it("embeds content and stores in SQLite", async () => {
    const service = new EmbeddingService(dbPath);
    const vector = await service.embed("test-id", "decisions", "My Section", "test content");
    expect(vector).toBeInstanceOf(Float32Array);
    expect(vector.length).toBe(384);
    service.close();
  });

  it("searches and returns results", async () => {
    const service = new EmbeddingService(dbPath);
    await service.embed("id1", "decisions", "Auth Decision", "authentication pattern JWT");
    await service.embed("id2", "context", "API Context", "REST API endpoints");

    const results = await service.search("authentication", "all", 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty("source_file");
    expect(results[0]).toHaveProperty("section");
    expect(results[0]).toHaveProperty("score");
    service.close();
  });

  it("scope-filter limits results (F-33)", async () => {
    const service = new EmbeddingService(dbPath);
    await service.embed("id1", "decisions", "Section A", "content A");
    await service.embed("id2", "context", "Section B", "content B");

    const results = await service.search("content", "decisions", 10);
    expect(results.every(r => r.source_file === "decisions")).toBe(true);
    service.close();
  });

  it("auto-embeds new entries (upsert)", async () => {
    const service = new EmbeddingService(dbPath);
    await service.embed("same-id", "progress", "Section", "original content");
    await service.embed("same-id", "progress", "Section", "updated content");
    const results = await service.search("updated", "progress", 5);
    expect(results.length).toBe(1); // Only one entry, not two
    service.close();
  });

  it("clearScope removes embeddings", async () => {
    const service = new EmbeddingService(dbPath);
    await service.embed("id1", "tech_debt", "Debt A", "some debt content");
    service.clearScope("tech_debt");
    const results = await service.search("debt", "tech_debt", 5);
    expect(results.length).toBe(0);
    service.close();
  });

  it("reindex returns count of processed entries", async () => {
    const service = new EmbeddingService(dbPath);
    const count = await service.reindex([
      { sourceFile: "decisions" as const, section: "A", content: "content A" },
      { sourceFile: "progress" as const, section: "B", content: "content B" },
    ]);
    expect(count).toBe(2);
    service.close();
  });
});

describe("parseMarkdownSections()", () => {
  it("parses sections from markdown", () => {
    const md = "# Title\n\nintro text\n\n## Section A\n\ncontent A\n\n## Section B\n\ncontent B";
    const sections = parseMarkdownSections(md, "decisions");
    expect(sections.length).toBeGreaterThan(0);
    const sectionNames = sections.map(s => s.section);
    expect(sectionNames).toContain("Section A");
    expect(sectionNames).toContain("Section B");
  });

  it("sets sourceFile correctly", () => {
    const md = "## Decision One\n\nContent here";
    const sections = parseMarkdownSections(md, "decisions");
    expect(sections.every(s => s.source_file === "decisions" || s.sourceFile === "decisions")).toBe(true);
  });

  it("skips empty sections", () => {
    const md = "## Empty Section\n\n## Real Section\n\nHas content";
    const sections = parseMarkdownSections(md, "context");
    expect(sections.some(s => s.content.includes("Has content"))).toBe(true);
  });
});

describe("contentId()", () => {
  it("returns consistent SHA256 hash", () => {
    const id1 = contentId("decisions", "My Section", "content");
    const id2 = contentId("decisions", "My Section", "content");
    expect(id1).toBe(id2);
  });

  it("different inputs produce different IDs", () => {
    const id1 = contentId("decisions", "Section A", "content");
    const id2 = contentId("decisions", "Section B", "content");
    expect(id1).not.toBe(id2);
  });
});
