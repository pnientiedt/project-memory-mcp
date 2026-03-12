import type { FileService } from "./file.js";
import type { EmbeddingService } from "./embedding.js";
import type { OllamaService } from "./ollama.js";
import { parseEntries, contentId, type ParsedEntry } from "./embedding.js";
import { mergeEntries } from "./summarization.js";
import type { MemoryScope } from "../types.js";

export interface DeduplicationResult {
  merged: number;   // number of merge operations performed
  removed: number;  // number of original entries replaced
  skipped: boolean; // true if dedup was skipped (not enough entries, entry not found, etc.)
}

export const SIMILARITY_THRESHOLD = 0.85;

function normalizeTitle(title: string): string {
  return title.replace(/^[\p{Emoji}\uFE0E\uFE0F\u200D\s]+/u, "").trim().toLowerCase();
}

export class DeduplicationService {
  constructor(
    private readonly fileService: FileService,
    private readonly embeddingService: EmbeddingService,
    private readonly ollamaService: OllamaService,
    private readonly threshold: number = SIMILARITY_THRESHOLD,
  ) {}

  /**
   * Check the newly written entry against all existing entries in the scope.
   * If a semantic duplicate is found (cosine similarity >= threshold), merge and rewrite.
   * O(n) — only the new entry is compared against existing ones, not all-pairs.
   */
  async runForScope(scope: MemoryScope, newSection: string): Promise<DeduplicationResult> {
    const fileContent = this.fileService.read(scope);
    const entries = parseEntries(fileContent);

    if (entries.length < 2) {
      return { merged: 0, removed: 0, skipped: true };
    }

    const newEntry = entries.find(e => normalizeTitle(e.section) === normalizeTitle(newSection));
    if (!newEntry) {
      return { merged: 0, removed: 0, skipped: true };
    }

    // Embed the new entry so it's in the DB, then search for similar existing entries
    const newId = `dedup:${scope}:${newEntry.hash}`;
    await this.embeddingService.embed(newId, scope, newEntry.section, newEntry.body);

    const candidates = await this.embeddingService.search(newEntry.body, scope, 5);

    // Exclude the entry itself; keep only those above the threshold
    const duplicates = candidates.filter(
      c => c.score >= this.threshold && normalizeTitle(c.section) !== normalizeTitle(newSection),
    );

    if (duplicates.length === 0) {
      return { merged: 0, removed: 0, skipped: false };
    }

    // Merge with the single highest-scoring duplicate
    const topMatch = duplicates[0];
    const existingEntry = entries.find(
      e => normalizeTitle(e.section) === normalizeTitle(topMatch.section),
    );
    if (!existingEntry) {
      return { merged: 0, removed: 0, skipped: true };
    }

    const mergedBody = await this.mergeWithFallback(newEntry.body, existingEntry.body);
    await this.replaceEntries(scope, fileContent, [newEntry, existingEntry], mergedBody);

    return { merged: 1, removed: 2, skipped: false };
  }

  private async mergeWithFallback(bodyA: string, bodyB: string): Promise<string> {
    try {
      const available = await this.ollamaService.isAvailable();
      if (!available) {
        return bodyA.length >= bodyB.length ? bodyA : bodyB;
      }
      const merged = await mergeEntries(this.ollamaService, bodyA, bodyB);
      if (merged && merged.trim().length > 10) {
        return merged.trim();
      }
      // LLM returned empty/garbage — fall back to longer
      return bodyA.length >= bodyB.length ? bodyA : bodyB;
    } catch {
      return bodyA.length >= bodyB.length ? bodyA : bodyB;
    }
  }

  private async replaceEntries(
    scope: MemoryScope,
    originalContent: string,
    toRemove: [ParsedEntry, ParsedEntry],
    mergedBody: string,
  ): Promise<void> {
    // Remove both original entries from file content
    let newContent = originalContent;
    for (const entry of toRemove) {
      newContent = newContent.replace(`${entry.raw}\n`, "").replace(entry.raw, "");
    }
    if (!newContent.endsWith("\n")) newContent += "\n";

    // Atomically write cleaned content, then append the merged entry
    this.fileService.write(scope, newContent);
    this.fileService.append(scope, mergedBody);

    // Embed the merged entry so the DB reflects the new canonical version
    const mergedSection = /^## (.+)$/m.exec(mergedBody)?.[1]?.trim() ?? "merged";
    const mergedId = contentId(scope, mergedSection, mergedBody);
    await this.embeddingService.embed(mergedId, scope, mergedSection, mergedBody).catch(() => {});
    // Stale embeddings for removed entries remain harmless until next reindex_memory
  }
}
