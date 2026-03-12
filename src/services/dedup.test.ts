import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { FileService } from "./file.js";
import { DeduplicationService, SIMILARITY_THRESHOLD } from "./dedup.js";
import { parseEntries } from "./embedding.js";
import type { EmbeddingService } from "./embedding.js";
import type { OllamaService } from "./ollama.js";
import type { SearchResult, ServerConfig } from "../types.js";

function makeConfig(baseDir: string): ServerConfig {
  return {
    ollama: { base_url: "http://localhost:11434", model: "llama3.2", timeout_seconds: 60, fallback_to_keywords: true },
    embeddings: { model: "Xenova/all-MiniLM-L6-v2", db_path: join(baseDir, "embeddings.db") },
    git: { hook_enabled: false, hook_port: 47832, skip_keyword: "[skip-memory]", summarize_diffs: false },
    watcher: { enabled: false, paths: [], debounce_ms: 2000 },
    session: { inactivity_timeout_minutes: 30, summarize_on_end: false },
    logging: { level: "info", file: join(baseDir, "server.log"), max_size_mb: 10 },
    memory: {
      base_dir: baseDir,
      files: { decisions: "decisions.md", tech_debt: "tech_debt.md", progress: "progress.md", context: "context.md" },
    },
  };
}

function makeEmbeddingStub(searchResults: SearchResult[] = []): EmbeddingService {
  return {
    embed: vi.fn().mockResolvedValue(new Float32Array(384)),
    search: vi.fn().mockResolvedValue(searchResults),
    clearScope: vi.fn(),
    close: vi.fn(),
  } as unknown as EmbeddingService;
}

function makeOllamaStub(available = true, mergeResult = "## Merged Entry\n\nMerged content."): OllamaService {
  return {
    isAvailable: vi.fn().mockResolvedValue(available),
    summarize: vi.fn().mockResolvedValue(mergeResult),
  } as unknown as OllamaService;
}

// Two entries that will be placed in the decisions file
const ENTRY_A = "<!-- date:2026-03-13 hash:aaaaaaaaaaaa -->\n## Auth Decision\n\nUse JWT tokens.";
const ENTRY_B = "<!-- date:2026-03-13 hash:bbbbbbbbbbbb -->\n## Authentication Decision\n\nUse JWT for auth.";
const FILE_PREAMBLE = "# Architecture Decisions\n\nThis file tracks architectural decisions.\n";

describe("parseEntries()", () => {
  it("returns empty array for file with no <!-- --> entries", () => {
    const content = "# Architecture Decisions\n\nNo entries yet.\n";
    expect(parseEntries(content)).toHaveLength(0);
  });

  it("correctly splits on <!-- date:... hash:... --> delimiters", () => {
    const content = `${FILE_PREAMBLE}\n${ENTRY_A}\n${ENTRY_B}\n`;
    const entries = parseEntries(content);
    expect(entries).toHaveLength(2);
    expect(entries[0].hash).toBe("aaaaaaaaaaaa");
    expect(entries[0].section).toBe("Auth Decision");
    expect(entries[0].body).toContain("Use JWT tokens.");
    expect(entries[1].hash).toBe("bbbbbbbbbbbb");
    expect(entries[1].section).toBe("Authentication Decision");
  });

  it("extracts H2 section title correctly", () => {
    const content = `${FILE_PREAMBLE}\n${ENTRY_A}\n`;
    const [entry] = parseEntries(content);
    expect(entry.section).toBe("Auth Decision");
  });

  it("handles entry with no H2 gracefully", () => {
    const content = `${FILE_PREAMBLE}\n<!-- date:2026-03-13 hash:cccccccccccc -->\nSome plain text without a heading.\n`;
    const [entry] = parseEntries(content);
    expect(entry.section).toBe("(untitled)");
  });
});

describe("DeduplicationService.runForScope()", () => {
  let tmpDir: string;
  let fileService: FileService;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `dedup-test-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tmpDir, { recursive: true });
    fileService = new FileService(makeConfig(tmpDir));
    fileService.initializeDirectory();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns skipped:true when file has fewer than 2 entries", async () => {
    fileService.append("decisions", "## Auth Decision\n\nUse JWT tokens.");
    const svc = new DeduplicationService(fileService, makeEmbeddingStub(), makeOllamaStub());
    const result = await svc.runForScope("decisions", "Auth Decision");
    expect(result.skipped).toBe(true);
    expect(result.merged).toBe(0);
  });

  it("returns skipped:true when newSection is not found in file", async () => {
    fileService.append("decisions", "## Auth Decision\n\nUse JWT tokens.");
    fileService.append("decisions", "## Caching Strategy\n\nUse Redis.");
    const svc = new DeduplicationService(fileService, makeEmbeddingStub(), makeOllamaStub());
    const result = await svc.runForScope("decisions", "NonExistentSection");
    expect(result.skipped).toBe(true);
  });

  it("returns merged:0 when all similarity scores are below threshold", async () => {
    fileService.append("decisions", "## Auth Decision\n\nUse JWT tokens.");
    fileService.append("decisions", "## Caching Strategy\n\nUse Redis.");
    const lowScoreResult: SearchResult[] = [
      { id: "x", source_file: "decisions", section: "Caching Strategy", content: "Use Redis.", score: 0.5 },
    ];
    const svc = new DeduplicationService(fileService, makeEmbeddingStub(lowScoreResult), makeOllamaStub());
    const result = await svc.runForScope("decisions", "Auth Decision");
    expect(result.merged).toBe(0);
    expect(result.skipped).toBe(false);
  });

  it("merges entries when similarity score >= threshold", async () => {
    fileService.append("decisions", "## Auth Decision\n\nUse JWT tokens.");
    fileService.append("decisions", "## Authentication Decision\n\nUse JWT for auth.");
    const highScoreResult: SearchResult[] = [
      { id: "y", source_file: "decisions", section: "Auth Decision", content: "Use JWT tokens.", score: SIMILARITY_THRESHOLD },
    ];
    const ollamaStub = makeOllamaStub(true, "## Auth & Authentication Decision\n\nUse JWT tokens for authentication.");
    const svc = new DeduplicationService(fileService, makeEmbeddingStub(highScoreResult), ollamaStub);
    const result = await svc.runForScope("decisions", "Authentication Decision");
    expect(result.merged).toBe(1);
    expect(result.removed).toBe(2);
    const content = fileService.read("decisions");
    expect(content).toContain("Auth & Authentication Decision");
    expect(content).not.toContain("## Auth Decision\n");
    expect(content).not.toContain("## Authentication Decision\n");
  });

  it("removes both originals and replaces with merged entry", async () => {
    fileService.append("decisions", "## Auth Decision\n\nUse JWT tokens.");
    fileService.append("decisions", "## Authentication Decision\n\nUse JWT for auth.");
    const highScoreResult: SearchResult[] = [
      { id: "y", source_file: "decisions", section: "Auth Decision", content: "Use JWT tokens.", score: 0.95 },
    ];
    const svc = new DeduplicationService(
      fileService,
      makeEmbeddingStub(highScoreResult),
      makeOllamaStub(true, "## Unified Auth Decision\n\nUse JWT."),
    );
    await svc.runForScope("decisions", "Authentication Decision");
    const content = fileService.read("decisions");
    // Merged entry present
    expect(content).toContain("Unified Auth Decision");
    // Both originals absent
    expect((content.match(/## Auth Decision/g) || []).length).toBe(0);
    expect((content.match(/## Authentication Decision/g) || []).length).toBe(0);
  });

  it("falls back to longer entry when Ollama is unavailable", async () => {
    const longBody = "## Auth Decision\n\nUse JWT tokens. This is a longer description with more details.";
    const shortBody = "## Authentication Decision\n\nUse JWT.";
    fileService.append("decisions", longBody);
    fileService.append("decisions", shortBody);
    const highScoreResult: SearchResult[] = [
      { id: "y", source_file: "decisions", section: "Auth Decision", content: longBody, score: 0.95 },
    ];
    const svc = new DeduplicationService(
      fileService,
      makeEmbeddingStub(highScoreResult),
      makeOllamaStub(false), // Ollama unavailable
    );
    await svc.runForScope("decisions", "Authentication Decision");
    const content = fileService.read("decisions");
    // Should keep the longer entry's content
    expect(content).toContain("longer description");
  });

  it("falls back to longer entry when Ollama summarize() throws", async () => {
    fileService.append("decisions", "## Auth Decision\n\nShort.");
    fileService.append("decisions", "## Authentication Decision\n\nUse JWT for auth with more context here.");
    const highScoreResult: SearchResult[] = [
      { id: "y", source_file: "decisions", section: "Auth Decision", content: "Short.", score: 0.95 },
    ];
    const ollamaStub = {
      isAvailable: vi.fn().mockResolvedValue(true),
      summarize: vi.fn().mockRejectedValue(new Error("Ollama timeout")),
    } as unknown as OllamaService;
    const svc = new DeduplicationService(fileService, makeEmbeddingStub(highScoreResult), ollamaStub);
    await expect(svc.runForScope("decisions", "Authentication Decision")).resolves.not.toThrow();
    const content = fileService.read("decisions");
    expect(content).toContain("more context here");
  });

  it("falls back to longer entry when Ollama returns empty string", async () => {
    fileService.append("decisions", "## Auth Decision\n\nShort.");
    fileService.append("decisions", "## Authentication Decision\n\nUse JWT for auth with details.");
    const highScoreResult: SearchResult[] = [
      { id: "y", source_file: "decisions", section: "Auth Decision", content: "Short.", score: 0.95 },
    ];
    const svc = new DeduplicationService(
      fileService,
      makeEmbeddingStub(highScoreResult),
      makeOllamaStub(true, ""), // empty response
    );
    await svc.runForScope("decisions", "Authentication Decision");
    const content = fileService.read("decisions");
    expect(content).toContain("with details");
  });
});
