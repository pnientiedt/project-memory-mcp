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

function makeEmbeddingStub(): EmbeddingService {
  return {
    clearScope: vi.fn(),
    reindex: vi.fn().mockResolvedValue(2),
    embed: vi.fn(),
    close: vi.fn(),
  } as unknown as EmbeddingService;
}

describe("Admin Tools", () => {
  let tmpDir: string;
  let fileService: FileService;
  let mockServer: MockMcpServer;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `test-admin-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    fileService = new FileService(makeConfig(tmpDir));
    fileService.initializeDirectory();
    mockServer = new MockMcpServer();
    vi.resetModules();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("reindex_memory", () => {
    it("reindexes all scopes when scope=all", async () => {
      const stub = makeEmbeddingStub();
      const { registerAdminTools } = await import("./admin.js");
      registerAdminTools(mockServer as never, fileService, stub);

      const result = await mockServer.callTool("reindex_memory", { scope: "all" }) as { content: Array<{ text: string }> };
      expect(result.content[0].text).toContain("Re-indexiert:");
      expect(stub.clearScope).toHaveBeenCalledTimes(4);
    });

    it("reindexes single scope", async () => {
      const stub = makeEmbeddingStub();
      const { registerAdminTools } = await import("./admin.js");
      registerAdminTools(mockServer as never, fileService, stub);

      fileService.append("decisions", "## Decision A\n\nSome content");
      const result = await mockServer.callTool("reindex_memory", { scope: "decisions" }) as { content: Array<{ text: string }> };
      expect(result.content[0].text).toContain("decisions");
      expect(stub.clearScope).toHaveBeenCalledWith("decisions");
      expect(stub.clearScope).toHaveBeenCalledTimes(1);
    });

    it("returns confirmation message", async () => {
      const stub = makeEmbeddingStub();
      const { registerAdminTools } = await import("./admin.js");
      registerAdminTools(mockServer as never, fileService, stub);

      const result = await mockServer.callTool("reindex_memory", { scope: "decisions" }) as { content: Array<{ text: string }> };
      expect(result.content[0].text).toMatch(/Re-indexiert: \d+ Abschnitte/);
    });
  });
});
