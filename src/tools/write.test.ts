import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { FileService } from "../services/file.js";
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

// Minimal mock of McpServer for testing tool registration
class MockMcpServer {
  tools: Record<string, { config: unknown; handler: (args: unknown) => unknown }> = {};

  registerTool(name: string, config: unknown, handler: (args: unknown) => unknown) {
    this.tools[name] = { config, handler };
  }

  async callTool(name: string, args: unknown) {
    return this.tools[name].handler(args);
  }
}

describe("Write Tools", () => {
  let tmpDir: string;
  let fileService: FileService;
  let mockServer: MockMcpServer;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `test-write-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    fileService = new FileService(makeConfig(tmpDir));
    fileService.initializeDirectory();
    mockServer = new MockMcpServer();

    const { registerWriteTools } = await import("./write.js");
    registerWriteTools(mockServer as never, fileService);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    vi.resetModules();
  });

  describe("add_decision", () => {
    it("writes a decision entry to decisions.md", async () => {
      await mockServer.callTool("add_decision", {
        title: "Use TypeScript",
        context: "We need type safety",
        decision: "Use TypeScript for all source files",
        status: "accepted",
      });
      const content = fileService.read("decisions");
      expect(content).toContain("## Use TypeScript");
      expect(content).toContain("**Status:** accepted");
    });

    it("returns written entry as confirmation (F-24)", async () => {
      const result = await mockServer.callTool("add_decision", {
        title: "Test Decision",
        context: "ctx",
        decision: "dec",
        status: "accepted",
      }) as { content: Array<{ text: string }> };
      expect(result.content[0].text).toContain("## Test Decision");
    });

    it("is idempotent (F-25)", async () => {
      const args = { title: "Idempotent", context: "ctx", decision: "dec", status: "accepted" as const };
      await mockServer.callTool("add_decision", args);
      await mockServer.callTool("add_decision", args);
      const content = fileService.read("decisions");
      expect((content.match(/## Idempotent/g) || []).length).toBe(1);
    });
  });

  describe("log_tech_debt", () => {
    it("writes a tech debt entry", async () => {
      await mockServer.callTool("log_tech_debt", {
        description: "Missing error handling in auth module",
        severity: "high",
      });
      const content = fileService.read("tech_debt");
      expect(content).toContain("Tech Debt [HIGH]");
      expect(content).toContain("Missing error handling");
    });

    it("includes affected files when provided", async () => {
      await mockServer.callTool("log_tech_debt", {
        description: "No tests",
        severity: "medium",
        affected_files: ["src/auth.ts", "src/routes.ts"],
      });
      const content = fileService.read("tech_debt");
      expect(content).toContain("src/auth.ts");
    });
  });

  describe("update_progress", () => {
    it("writes a progress entry", async () => {
      await mockServer.callTool("update_progress", {
        milestone: "Phase 1 Complete",
        status: "done",
      });
      const content = fileService.read("progress");
      expect(content).toContain("Phase 1 Complete");
      expect(content).toContain("**Status:** done");
    });

    it("includes emoji for status", async () => {
      await mockServer.callTool("update_progress", {
        milestone: "Feature X",
        status: "in-progress",
      });
      const content = fileService.read("progress");
      expect(content).toContain("🔄");
    });
  });

  describe("add_context", () => {
    it("writes a context entry", async () => {
      await mockServer.callTool("add_context", {
        content: "The API uses REST with JSON responses",
        category: "api",
      });
      const content = fileService.read("context");
      expect(content).toContain("[api]");
      expect(content).toContain("REST with JSON");
    });

    it("works without category", async () => {
      await mockServer.callTool("add_context", {
        content: "Some freeform context",
      });
      const content = fileService.read("context");
      expect(content).toContain("Some freeform context");
    });
  });
});
