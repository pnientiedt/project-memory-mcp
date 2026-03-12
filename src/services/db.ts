import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "fs";
import { dirname } from "path";

export function openDatabase(dbPath: string): Database.Database {
  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);

  // Enable WAL mode for concurrent reads without blocking writes
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");

  createSchema(db);
  return db;
}

function createSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS embeddings (
      id          TEXT PRIMARY KEY,
      source_file TEXT NOT NULL,
      section     TEXT NOT NULL,
      content     TEXT NOT NULL,
      vector      BLOB NOT NULL,
      created_at  INTEGER NOT NULL,
      updated_at  INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_source_file ON embeddings(source_file);
    CREATE INDEX IF NOT EXISTS idx_created_at ON embeddings(created_at);
  `);
}

export type EmbeddingRow = {
  id: string;
  source_file: string;
  section: string;
  content: string;
  vector: Buffer;
  created_at: number;
  updated_at: number;
};
