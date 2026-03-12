import { describe, it, expect, afterEach } from "vitest";
import { rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { openDatabase } from "./db.js";

describe("SQLite Schema", () => {
  let dbPath: string;

  afterEach(() => {
    try {
      rmSync(dbPath, { force: true });
      rmSync(`${dbPath}-wal`, { force: true });
      rmSync(`${dbPath}-shm`, { force: true });
    } catch {
      // ignore
    }
  });

  it("creates embeddings table on first open", () => {
    dbPath = join(tmpdir(), `test-db-${Date.now()}.db`);
    const db = openDatabase(dbPath);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    expect(tables.map(t => t.name)).toContain("embeddings");
    db.close();
  });

  it("creates source_file index", () => {
    dbPath = join(tmpdir(), `test-db-${Date.now()}.db`);
    const db = openDatabase(dbPath);
    const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all() as { name: string }[];
    expect(indexes.map(i => i.name)).toContain("idx_source_file");
    db.close();
  });

  it("creates created_at index", () => {
    dbPath = join(tmpdir(), `test-db-${Date.now()}.db`);
    const db = openDatabase(dbPath);
    const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all() as { name: string }[];
    expect(indexes.map(i => i.name)).toContain("idx_created_at");
    db.close();
  });

  it("enables WAL mode", () => {
    dbPath = join(tmpdir(), `test-db-${Date.now()}.db`);
    const db = openDatabase(dbPath);
    const result = db.prepare("PRAGMA journal_mode").get() as { journal_mode: string };
    expect(result.journal_mode).toBe("wal");
    db.close();
  });

  it("is idempotent — open twice without error", () => {
    dbPath = join(tmpdir(), `test-db-${Date.now()}.db`);
    const db1 = openDatabase(dbPath);
    db1.close();
    const db2 = openDatabase(dbPath);
    const tables = db2.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    expect(tables.map(t => t.name)).toContain("embeddings");
    db2.close();
  });
});
