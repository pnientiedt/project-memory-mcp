import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { join } from "path";
import { createHash, randomBytes } from "crypto";
import type { MemoryScope, ServerConfig } from "../types.js";

export class FileService {
  private readonly baseDir: string;
  private readonly files: Record<MemoryScope, string>;

  constructor(config: ServerConfig) {
    this.baseDir = config.memory.base_dir;
    this.files = {
      decisions: join(this.baseDir, config.memory.files.decisions),
      tech_debt: join(this.baseDir, config.memory.files.tech_debt),
      progress: join(this.baseDir, config.memory.files.progress),
      context: join(this.baseDir, config.memory.files.context),
    };
  }

  /**
   * Initialize .project-memory/ directory and default files on first start (F-03).
   */
  initializeDirectory(): void {
    if (!existsSync(this.baseDir)) {
      mkdirSync(this.baseDir, { recursive: true });
    }

    const defaults: Record<MemoryScope, string> = {
      decisions: "# Architecture Decisions\n\nThis file tracks architectural decisions (ADRs) for this project.\n",
      tech_debt: "# Technical Debt\n\nThis file tracks known technical debt and issues.\n",
      progress: "# Project Progress\n\nThis file tracks project milestones and progress.\n",
      context: "# Domain Context\n\nThis file stores domain knowledge, conventions, and context.\n",
    };

    for (const [scope, path] of Object.entries(this.files) as [MemoryScope, string][]) {
      if (!existsSync(path)) {
        this.atomicWrite(path, defaults[scope]);
      }
    }
  }

  /**
   * Read the content of a memory file.
   */
  read(scope: MemoryScope): string {
    const path = this.files[scope];
    if (!existsSync(path)) {
      return "";
    }
    return readFileSync(path, "utf-8");
  }

  /**
   * Append an entry to a memory file (idempotent — no duplicate if content hash matches).
   * Returns the written entry text.
   */
  append(scope: MemoryScope, entry: string): string {
    const path = this.files[scope];
    const existing = existsSync(path) ? readFileSync(path, "utf-8") : "";

    // Idempotency check (F-25): skip if entry already exists
    const entryHash = hashContent(entry);
    if (existing.includes(`hash:${entryHash}`)) {
      return entry;
    }

    const dated = formatEntry(entry, entryHash);
    const newContent = existing + (existing.endsWith("\n") ? "" : "\n") + dated + "\n";
    this.atomicWrite(path, newContent);
    return dated;
  }

  /**
   * Upsert an entry: replace the existing H2 section matching sectionTitle, or append if not found.
   * Matching is case-insensitive and strips leading emoji characters for comparison.
   * Returns the written entry text.
   */
  upsert(scope: MemoryScope, sectionTitle: string, entry: string): string {
    const path = this.files[scope];
    const existing = existsSync(path) ? readFileSync(path, "utf-8") : "";

    const entryHash = hashContent(entry);
    const dated = formatEntry(entry, entryHash);
    const normalizedTarget = normalizeTitle(sectionTitle);

    // Split file into: preamble (before first ##) and sections (each starting with ##)
    const sectionPattern = /(?=^## )/m;
    const parts = existing.split(sectionPattern);
    const preamble = parts[0];
    const sections = parts.slice(1);

    const matchIndex = sections.findIndex(s => {
      const header = s.split("\n")[0]; // e.g. "## 🔄 My Feature"
      return normalizeTitle(header.replace(/^##\s*/, "")) === normalizedTarget;
    });

    if (matchIndex === -1) {
      // Not found — fall back to append
      const newContent = existing + (existing.endsWith("\n") ? "" : "\n") + dated + "\n";
      this.atomicWrite(path, newContent);
      return dated;
    }

    // Replace the matched section
    sections[matchIndex] = dated + "\n";
    const newContent = preamble + sections.join("");
    this.atomicWrite(path, newContent);
    return dated;
  }

  /**
   * Overwrite the full content of a memory file atomically.
   */
  write(scope: MemoryScope, content: string): void {
    const path = this.files[scope];
    this.atomicWrite(path, content);
  }

  /**
   * Return path for a given scope.
   */
  getPath(scope: MemoryScope): string {
    return this.files[scope];
  }

  /**
   * Atomic write via tmp file + rename to prevent partial writes (F-05).
   */
  private atomicWrite(path: string, content: string): void {
    const tmp = `${path}.${randomBytes(6).toString("hex")}.tmp`;
    writeFileSync(tmp, content, { encoding: "utf-8", mode: 0o600 });
    renameSync(tmp, path);
  }
}

function normalizeTitle(title: string): string {
  // Strip leading emoji (Unicode emoji + variation selectors + ZWJ sequences) and whitespace
  return title.replace(/^[\p{Emoji}\uFE0E\uFE0F\u200D\s]+/u, "").trim().toLowerCase();
}

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 12);
}

function formatEntry(entry: string, hash: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `<!-- date:${date} hash:${hash} -->\n${entry}`;
}
