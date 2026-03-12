import { describe, it, expect, beforeEach, afterEach } from "vitest";
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

class MockMcpServer {
  resources: Record<string, { handler: () => unknown }> = {};

  registerResource(name: string, _uri: string, _meta: unknown, handler: () => unknown) {
    this.resources[name] = { handler };
  }

  async readResource(name: string) {
    return this.resources[name].handler();
  }
}

describe("Memory Resources", () => {
  let tmpDir: string;
  let fileService: FileService;
  let mockServer: MockMcpServer;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `test-resources-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    fileService = new FileService(makeConfig(tmpDir));
    fileService.initializeDirectory();
    mockServer = new MockMcpServer();

    const { registerMemoryResources } = await import("./memory.js");
    registerMemoryResources(mockServer as never, fileService);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("registers all 4 memory resources", () => {
    const names = Object.keys(mockServer.resources);
    expect(names).toContain("Architecture Decisions");
    expect(names).toContain("Technical Debt");
    expect(names).toContain("Project Progress");
    expect(names).toContain("Domain Context");
  });

  it("decisions resource returns file content", async () => {
    fileService.append("decisions", "## My ADR\n\nContent");
    const result = await mockServer.readResource("Architecture Decisions") as {
      contents: Array<{ uri: string; mimeType: string; text: string }>;
    };
    expect(result.contents[0].uri).toBe("memory://decisions");
    expect(result.contents[0].mimeType).toBe("text/markdown");
    expect(result.contents[0].text).toContain("## My ADR");
  });

  it("tech-debt resource returns file content", async () => {
    fileService.append("tech_debt", "## Some Debt\n\nContent");
    const result = await mockServer.readResource("Technical Debt") as {
      contents: Array<{ uri: string; text: string }>;
    };
    expect(result.contents[0].uri).toBe("memory://tech-debt");
    expect(result.contents[0].text).toContain("Some Debt");
  });

  it("progress resource returns file content", async () => {
    const result = await mockServer.readResource("Project Progress") as {
      contents: Array<{ uri: string; text: string }>;
    };
    expect(result.contents[0].uri).toBe("memory://progress");
  });

  it("context resource returns file content", async () => {
    const result = await mockServer.readResource("Domain Context") as {
      contents: Array<{ uri: string; text: string }>;
    };
    expect(result.contents[0].uri).toBe("memory://context");
  });
});
