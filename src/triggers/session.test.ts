import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { SessionManager } from "./session.js";
import { FileService } from "../services/file.js";
import type { ServerConfig } from "../types.js";

vi.useFakeTimers();

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

describe("SessionManager", () => {
  let tmpDir: string;
  let fileService: FileService;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `test-session-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    fileService = new FileService(makeConfig(tmpDir));
    fileService.initializeDirectory();
  });

  afterEach(() => {
    vi.clearAllTimers();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("fires inactivity timer after configured timeout", () => {
    const config = makeConfig(tmpDir);
    config.session.inactivity_timeout_minutes = 1;
    const manager = new SessionManager(config.session, fileService);

    vi.advanceTimersByTime(60 * 1000 + 100);

    const content = fileService.read("progress");
    expect(content).toContain("Session Summary");
    manager.close();
  });

  it("resets timer on activity", () => {
    const config = makeConfig(tmpDir);
    config.session.inactivity_timeout_minutes = 1;
    const manager = new SessionManager(config.session, fileService);

    // Advance 50 seconds, then record activity
    vi.advanceTimersByTime(50 * 1000);
    manager.recordActivity("add_decision");

    // Advance another 50 seconds — should not have fired yet
    vi.advanceTimersByTime(50 * 1000);
    const contentBefore = fileService.read("progress");
    expect(contentBefore).not.toContain("Session Summary");

    // Now advance to full timeout
    vi.advanceTimersByTime(11 * 1000);
    const contentAfter = fileService.read("progress");
    expect(contentAfter).toContain("Session Summary");
    manager.close();
  });

  it("session summary contains required fields (F-52)", () => {
    const config = makeConfig(tmpDir);
    config.session.inactivity_timeout_minutes = 1;
    const manager = new SessionManager(config.session, fileService);

    manager.recordActivity("add_decision", "src/auth.ts", "Use JWT");
    vi.advanceTimersByTime(61 * 1000);

    const content = fileService.read("progress");
    expect(content).toContain("Datum:");
    expect(content).toContain("Dauer:");
    expect(content).toContain("Tool-Calls:");
    manager.close();
  });

  it("close() forces summary write", () => {
    const config = makeConfig(tmpDir);
    const manager = new SessionManager(config.session, fileService);
    manager.recordActivity("update_progress");
    manager.close();

    const content = fileService.read("progress");
    expect(content).toContain("Session Summary");
  });

  it("does not write summary when summarize_on_end is false", () => {
    const config = makeConfig(tmpDir);
    config.session.summarize_on_end = false;
    const manager = new SessionManager(config.session, fileService);
    manager.close();

    const content = fileService.read("progress");
    expect(content).not.toContain("Session Summary");
  });
});
