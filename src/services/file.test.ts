import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { FileService } from "./file.js";
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

describe("FileService", () => {
  let tmpDir: string;
  let service: FileService;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `test-file-${Date.now()}`);
    service = new FileService(makeConfig(tmpDir));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("initializeDirectory()", () => {
    it("creates the base directory", () => {
      service.initializeDirectory();
      expect(existsSync(tmpDir)).toBe(true);
    });

    it("creates all four default memory files", () => {
      service.initializeDirectory();
      expect(existsSync(join(tmpDir, "decisions.md"))).toBe(true);
      expect(existsSync(join(tmpDir, "tech_debt.md"))).toBe(true);
      expect(existsSync(join(tmpDir, "progress.md"))).toBe(true);
      expect(existsSync(join(tmpDir, "context.md"))).toBe(true);
    });

    it("is idempotent — does not throw if directory already exists", () => {
      mkdirSync(tmpDir, { recursive: true });
      expect(() => service.initializeDirectory()).not.toThrow();
    });

    it("does not overwrite existing files", () => {
      service.initializeDirectory();
      const path = join(tmpDir, "decisions.md");
      const original = readFileSync(path, "utf-8");
      service.initializeDirectory();
      expect(readFileSync(path, "utf-8")).toBe(original);
    });
  });

  describe("read()", () => {
    beforeEach(() => service.initializeDirectory());

    it("returns file content", () => {
      const content = service.read("decisions");
      expect(content).toContain("Architecture Decisions");
    });

    it("returns empty string for non-existent file", () => {
      rmSync(join(tmpDir, "decisions.md"));
      expect(service.read("decisions")).toBe("");
    });
  });

  describe("append()", () => {
    beforeEach(() => service.initializeDirectory());

    it("appends entry to file", () => {
      service.append("decisions", "## My Decision\n\nSome content");
      const content = service.read("decisions");
      expect(content).toContain("## My Decision");
    });

    it("returns the written entry", () => {
      const result = service.append("decisions", "## Test Decision\n\nContent");
      expect(result).toContain("## Test Decision");
    });

    it("includes date and hash comment", () => {
      const result = service.append("context", "test content");
      expect(result).toMatch(/<!-- date:\d{4}-\d{2}-\d{2} hash:[a-f0-9]+ -->/);
    });

    it("is idempotent — same entry not appended twice", () => {
      const entry = "## Duplicate Entry\n\nContent";
      service.append("decisions", entry);
      service.append("decisions", entry);
      const content = service.read("decisions");
      const count = (content.match(/## Duplicate Entry/g) || []).length;
      expect(count).toBe(1);
    });

    it("allows different entries", () => {
      service.append("decisions", "## Entry A\n\nA");
      service.append("decisions", "## Entry B\n\nB");
      const content = service.read("decisions");
      expect(content).toContain("## Entry A");
      expect(content).toContain("## Entry B");
    });
  });

  describe("write()", () => {
    beforeEach(() => service.initializeDirectory());

    it("overwrites file content", () => {
      service.write("context", "# New Content\n");
      expect(service.read("context")).toBe("# New Content\n");
    });
  });
});
