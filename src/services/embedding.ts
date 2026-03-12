import { createHash } from "crypto";
import { openDatabase, type EmbeddingRow } from "./db.js";
import type { Database } from "better-sqlite3";
import type { SearchResult, MemoryScope } from "../types.js";

type PipelineFunction = (text: string, options?: Record<string, unknown>) => Promise<{
  data: Float32Array;
}>;

let pipelineInstance: PipelineFunction | null = null;

async function getPipeline(modelName: string): Promise<PipelineFunction> {
  if (pipelineInstance) return pipelineInstance;

  // Lazy-load @huggingface/transformers to avoid startup delay
  const { pipeline } = await import("@huggingface/transformers");
  pipelineInstance = await pipeline("feature-extraction", modelName, { progress_callback: undefined }) as unknown as PipelineFunction;
  return pipelineInstance;
}

export class EmbeddingService {
  private db: Database;
  private modelName: string;

  constructor(dbPath: string, modelName = "Xenova/all-MiniLM-L6-v2") {
    this.db = openDatabase(dbPath);
    this.modelName = modelName;
  }

  /**
   * Compute embedding for text and store/update in SQLite.
   * Returns the embedding vector.
   */
  async embed(
    id: string,
    sourceFile: MemoryScope,
    section: string,
    content: string,
  ): Promise<Float32Array> {
    const pipe = await getPipeline(this.modelName);
    const output = await pipe(content, { pooling: "mean", normalize: true });
    const vector = output.data;

    const now = Math.floor(Date.now() / 1000);
    const vectorBlob = Buffer.from(vector.buffer);

    const existing = this.db.prepare("SELECT id FROM embeddings WHERE id = ?").get(id);
    if (existing) {
      this.db.prepare(
        "UPDATE embeddings SET vector = ?, content = ?, updated_at = ? WHERE id = ?"
      ).run(vectorBlob, content, now, id);
    } else {
      this.db.prepare(
        "INSERT INTO embeddings (id, source_file, section, content, vector, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(id, sourceFile, section, content, vectorBlob, now, now);
    }

    return vector;
  }

  /**
   * Search for similar entries using cosine similarity.
   */
  async search(
    query: string,
    scope: MemoryScope | "all",
    topK: number,
  ): Promise<SearchResult[]> {
    const pipe = await getPipeline(this.modelName);
    const output = await pipe(query, { pooling: "mean", normalize: true });
    const queryVector = output.data;

    let rows: EmbeddingRow[];
    if (scope === "all") {
      rows = this.db.prepare("SELECT * FROM embeddings").all() as EmbeddingRow[];
    } else {
      rows = this.db.prepare("SELECT * FROM embeddings WHERE source_file = ?").all(scope) as EmbeddingRow[];
    }

    const scored = rows.map(row => {
      const rowVector = new Float32Array(row.vector.buffer, row.vector.byteOffset, row.vector.byteLength / 4);
      const score = cosineSimilarity(queryVector, rowVector);
      return {
        id: row.id,
        source_file: row.source_file as MemoryScope,
        section: row.section,
        content: row.content,
        score,
      };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /**
   * Re-index all content from parsed sections.
   */
  async reindex(entries: Array<{ sourceFile: MemoryScope; section: string; content: string }>): Promise<number> {
    let count = 0;
    for (const entry of entries) {
      const id = contentId(entry.sourceFile, entry.section, entry.content);
      await this.embed(id, entry.sourceFile, entry.section, entry.content);
      count++;
    }
    return count;
  }

  /**
   * Delete all embeddings for a given source file.
   */
  clearScope(scope: MemoryScope): void {
    this.db.prepare("DELETE FROM embeddings WHERE source_file = ?").run(scope);
  }

  close(): void {
    this.db.close();
  }
}

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function contentId(sourceFile: string, section: string, content: string): string {
  return createHash("sha256")
    .update(`${sourceFile}:${section}:${content}`)
    .digest("hex");
}

export interface ParsedEntry {
  raw: string;      // full block including the <!-- --> header line
  header: string;   // e.g. "<!-- date:2024-01-01 hash:abc123def456 -->"
  hash: string;     // e.g. "abc123def456"
  body: string;     // everything after the <!-- --> header line
  section: string;  // the H2 title (stripped of leading ##)
}

const ENTRY_HEADER_RE = /<!-- date:(\d{4}-\d{2}-\d{2}) hash:([a-f0-9]{12}) -->/;

/**
 * Parse a memory file into individual entries by splitting on the <!-- date:... hash:... --> delimiter.
 */
export function parseEntries(fileContent: string): ParsedEntry[] {
  const chunks = fileContent.split(/(?=<!-- date:\d{4}-\d{2}-\d{2} hash:[a-f0-9]{12} -->)/);
  const entries: ParsedEntry[] = [];

  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;
    const match = ENTRY_HEADER_RE.exec(trimmed);
    if (!match) continue; // preamble before any entry

    const headerLine = match[0];
    const body = trimmed.slice(headerLine.length).trim();
    if (!body) continue;

    const h2Match = /^## (.+)$/m.exec(body);
    const section = h2Match ? h2Match[1].trim() : "(untitled)";

    entries.push({ raw: trimmed, header: headerLine, hash: match[2], body, section });
  }

  return entries;
}

/**
 * Parse markdown file into sections for embedding.
 */
export function parseMarkdownSections(
  content: string,
  sourceFile: MemoryScope,
): Array<{ sourceFile: MemoryScope; section: string; content: string }> {
  const lines = content.split("\n");
  const sections: Array<{ sourceFile: MemoryScope; section: string; content: string }> = [];
  let currentSection = "intro";
  let currentLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (currentLines.length > 0 && currentLines.join("\n").trim()) {
        sections.push({ sourceFile, section: currentSection, content: currentLines.join("\n").trim() });
      }
      currentSection = line.slice(3).trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.length > 0 && currentLines.join("\n").trim()) {
    sections.push({ sourceFile, section: currentSection, content: currentLines.join("\n").trim() });
  }

  return sections;
}
