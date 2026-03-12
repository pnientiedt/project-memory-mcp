import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { FileService } from "../services/file.js";
import type { EmbeddingService } from "../services/embedding.js";
import type { ServerConfig } from "../types.js";

function makeConfig(baseDir: string): ServerConfig {
  return {
    ollama: { base_url: "http://localhost:11434", model: "llama3.2", timeout_seconds: 60, fallback_to_keywords: true },
    embeddings: { model: "Xenova/all-MiniLM-L6-v2", db_path: join(baseDir, "embeddings.db") },
    git: { hook_enabled: true, hook_port: 47832, skip_keyword: "[skip-memory]", summarize_diffs: true },
    watcher: { enabled: true, paths: ["CLAUDE.md"], debounce_ms: 2000 },
    session: { inactivity_timeout_minutes: 30, summarize_on_end: true },
    logging: { level: "info", file: join(baseDir, "server.log"), max_size_mb: 10 },
    memory: {
      base_dir: baseDir,
      files: { decisions: "decisions.md", tech_debt: "tech_debt.md", progress: "progress.md", context: "context.md" },
    },
  };
}

class MockMcpServer {
  tools: Record<string, { handler: (args: unknown) => unknown }> = {};

  registerTool(name: string, _config: unknown, handler: (args: unknown) => unknown) {
    this.tools[name] = { handler };
  }

  async callTool(name: string, args: unknown) {
    return this.tools[name].handler(args);
  }
}

function makeEmbeddingStub(results = [{ id: "1", source_file: "decisions", section: "Auth", content: "JWT auth", score: 0.85 }]): EmbeddingService {
  return {
    search: vi.fn().mockResolvedValue(results),
    embed: vi.fn(),
    close: vi.fn(),
  } as unknown as EmbeddingService;
}

describe("Read Tools", () => {
  let tmpDir: string;
  let fileService: FileService;
  let mockServer: MockMcpServer;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `test-read-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    fileService = new FileService(makeConfig(tmpDir));
    fileService.initializeDirectory();
    mockServer = new MockMcpServer();
    vi.resetModules();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("get_memory", () => {
    it("reads file content", async () => {
      fileService.append("decisions", "## Test Decision\n\nContent");
      const { registerReadTools } = await import("./read.js");
      registerReadTools(mockServer as never, fileService);
      const result = await mockServer.callTool("get_memory", { scope: "decisions" }) as { content: Array<{ text: string }> };
      expect(result.content[0].text).toContain("## Test Decision");
    });

    it("returns (empty) for empty file", async () => {
      const { registerReadTools } = await import("./read.js");
      registerReadTools(mockServer as never, fileService);
      // Delete the default file to simulate empty
      fileService.write("context", "");
      const result = await mockServer.callTool("get_memory", { scope: "context" }) as { content: Array<{ text: string }> };
      // empty string returns "(empty)"
      expect(result.content[0].text).toContain("(empty)");
    });
  });

  describe("search_memory", () => {
    it("uses embedding service for semantic search", async () => {
      const stub = makeEmbeddingStub();
      const { registerReadTools } = await import("./read.js");
      registerReadTools(mockServer as never, fileService, stub);
      const result = await mockServer.callTool("search_memory", { query: "JWT auth", scope: "all", top_k: 5 }) as { content: Array<{ text: string }> };
      expect(result.content[0].text).toContain("decisions/Auth");
      expect(result.content[0].text).toContain("0.850");
    });

    it("returns no results message when embedding returns empty", async () => {
      const stub = makeEmbeddingStub([]);
      const { registerReadTools } = await import("./read.js");
      registerReadTools(mockServer as never, fileService, stub);
      const result = await mockServer.callTool("search_memory", { query: "nothing", scope: "all", top_k: 5 }) as { content: Array<{ text: string }> };
      expect(result.content[0].text).toContain("No results found");
    });

    it("falls back to keyword search without embedding service", async () => {
      const { registerReadTools } = await import("./read.js");
      registerReadTools(mockServer as never, fileService);
      fileService.append("decisions", "## Auth Decision\n\nJWT authentication pattern");
      const result = await mockServer.callTool("search_memory", { query: "authentication", scope: "all", top_k: 5 }) as { content: Array<{ text: string }> };
      expect(result.content[0].text).toContain("[decisions]");
    });

    it("keyword fallback returns no results message when nothing found", async () => {
      const { registerReadTools } = await import("./read.js");
      registerReadTools(mockServer as never, fileService);
      const result = await mockServer.callTool("search_memory", { query: "xyznotfound", scope: "all", top_k: 5 }) as { content: Array<{ text: string }> };
      expect(result.content[0].text).toContain("No results found");
    });
  });
});
