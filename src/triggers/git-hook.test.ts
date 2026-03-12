import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { FileService } from "../services/file.js";
import type { ServerConfig } from "../types.js";
import type { OllamaService } from "../services/ollama.js";
import type { EmbeddingService } from "../services/embedding.js";

// Mock autoCommitMemory so E2E tests don't need a real git repo
vi.mock("../services/memory-commit.js", () => ({
  autoCommitMemory: vi.fn().mockResolvedValue(undefined),
}));

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

// Minimal stubs — no fetch mock (tests use real fetch to call our HTTP server)
function makeOllamaStub(): OllamaService {
  return {
    isAvailable: vi.fn().mockResolvedValue(false),
    summarize: vi.fn().mockResolvedValue("Keywords: auth, pattern"),
  } as unknown as OllamaService;
}

function makeEmbeddingStub(): EmbeddingService {
  return {
    embed: vi.fn().mockResolvedValue(new Float32Array(384)),
    close: vi.fn(),
  } as unknown as EmbeddingService;
}

describe("Git Hook Server", () => {
  let tmpDir: string;
  let fileService: FileService;
  let closeServer: { close: () => void };
  let port: number;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `test-hook-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    fileService = new FileService(makeConfig(tmpDir));
    fileService.initializeDirectory();

    // Use random high port to avoid conflicts
    port = 47910 + Math.floor(Math.random() * 80);

    const { startGitHookServer } = await import("./git-hook.js");
    closeServer = startGitHookServer(
      port,
      "[skip-memory]",
      fileService,
      makeOllamaStub(),
      makeEmbeddingStub(),
    );

    // Small delay to ensure server is listening
    await new Promise(r => setTimeout(r, 20));
  });

  afterEach(() => {
    closeServer?.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("endpoint is reachable and returns 200", async () => {
    const response = await fetch(`http://localhost:${port}/internal/git-event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "post-commit",
        message: "feat: add feature",
        diff: "some diff",
        changed_files: ["src/index.ts"],
        timestamp: 1700000000,
      }),
    });
    expect(response.status).toBe(200);
    const body = await response.json() as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it("returns 404 for unknown endpoints", async () => {
    const response = await fetch(`http://localhost:${port}/unknown`, { method: "POST" });
    expect(response.status).toBe(404);
  });

  it("returns 404 for GET requests", async () => {
    const response = await fetch(`http://localhost:${port}/internal/git-event`);
    expect(response.status).toBe(404);
  });

  it("accepts skip-memory commits without error", async () => {
    const response = await fetch(`http://localhost:${port}/internal/git-event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "post-commit",
        message: "chore: update deps [skip-memory]",
        diff: "",
        changed_files: [],
        timestamp: 1700000000,
      }),
    });
    expect(response.status).toBe(200);
  });

  it("handles malformed JSON gracefully", async () => {
    const response = await fetch(`http://localhost:${port}/internal/git-event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json at all",
    });
    // Should still respond 200 (async processing handles errors internally)
    expect(response.status).toBe(200);
  });
});

describe("Git Hook Server — E2E pipeline", () => {
  let tmpDir: string;
  let fileService: FileService;
  let closeServer: { close: () => void };
  let port: number;
  let ollamaStub: OllamaService;
  let loggedEvents: Array<{ level: string; message: string; data?: unknown }>;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `test-e2e-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    fileService = new FileService(makeConfig(tmpDir));
    fileService.initializeDirectory();

    loggedEvents = [];
    const logger = (level: string, message: string, data?: unknown) => {
      loggedEvents.push({ level, message, data });
    };

    // Ollama stub that returns a real-looking progress summary
    ollamaStub = {
      isAvailable: vi.fn().mockResolvedValue(true),
      summarize: vi.fn().mockResolvedValue(
        "## Progress Update\n\nFixed authentication bug in login flow.",
      ),
    } as unknown as OllamaService;

    port = 47990 + Math.floor(Math.random() * 9);

    const { startGitHookServer } = await import("./git-hook.js");
    closeServer = startGitHookServer(
      port,
      "[skip-memory]",
      fileService,
      ollamaStub,
      makeEmbeddingStub(),
      logger,
    );

    await new Promise(r => setTimeout(r, 20));
  });

  afterEach(() => {
    closeServer?.close();
    rmSync(tmpDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it("git-event results in memory file being updated", async () => {
    const response = await fetch(`http://localhost:${port}/internal/git-event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "post-commit",
        message: "fix: resolve auth bug",
        diff: "-old line\n+new line",
        changed_files: ["src/auth.ts"],
        timestamp: 1700000000,
      }),
    });

    expect(response.status).toBe(200);

    // Wait for async processing to complete
    await new Promise(r => setTimeout(r, 200));

    // Progress file should contain the summary from Ollama
    const progressPath = join(tmpDir, "progress.md");
    const content = readFileSync(progressPath, "utf-8");
    expect(content).toContain("Fixed authentication bug");
  });

  it("logger receives git-event-received and memory-updated events", async () => {
    await fetch(`http://localhost:${port}/internal/git-event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "post-commit",
        message: "feat: add new feature",
        diff: "+new code",
        changed_files: ["src/feature.ts"],
        timestamp: 1700000001,
      }),
    });

    await new Promise(r => setTimeout(r, 200));

    const messages = loggedEvents.map(e => e.message);
    expect(messages).toContain("git-event received");
    expect(messages).toContain("memory updated");
  });

  it("skip-memory commits do not update memory files or log git-event received", async () => {
    const progressPath = join(tmpDir, "progress.md");
    const before = readFileSync(progressPath, "utf-8");

    await fetch(`http://localhost:${port}/internal/git-event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "post-commit",
        message: "chore: update deps [skip-memory]",
        diff: "",
        changed_files: [],
        timestamp: 1700000002,
      }),
    });

    await new Promise(r => setTimeout(r, 100));

    const after = readFileSync(progressPath, "utf-8");
    expect(after).toBe(before); // unchanged
    expect(loggedEvents.map(e => e.message)).not.toContain("git-event received");
  });

  it("autoCommitMemory is called after memory files are written", async () => {
    const { autoCommitMemory } = await import("../services/memory-commit.js");

    await fetch(`http://localhost:${port}/internal/git-event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "post-commit",
        message: "refactor: extract helper",
        diff: "+helper code",
        changed_files: ["src/helper.ts"],
        timestamp: 1700000003,
      }),
    });

    await new Promise(r => setTimeout(r, 200));

    expect(autoCommitMemory).toHaveBeenCalledWith("[skip-memory]");
  });
});
