import { createServer as createHttpServer } from "http";
import type { FileService } from "../services/file.js";
import { autoCommitMemory } from "../services/memory-commit.js";
import type { OllamaService } from "../services/ollama.js";
import type { EmbeddingService } from "../services/embedding.js";
import { summarizeCommit } from "../services/summarization.js";
import { parseMarkdownSections, contentId } from "../services/embedding.js";
import type { GitEvent, Logger, MemoryScope } from "../types.js";

const noop: Logger = () => {};

export function startGitHookServer(
  port: number,
  skipKeyword: string,
  fileService: FileService,
  ollamaService: OllamaService,
  embeddingService: EmbeddingService,
  logger: Logger = noop,
): { close: () => void } {
  const BODY_LIMIT = 1024 * 1024; // 1 MB

  const server = createHttpServer((req, res) => {
    if (req.method !== "POST" || req.url !== "/internal/git-event") {
      res.writeHead(404);
      res.end();
      return;
    }

    let body = "";
    let bodySize = 0;
    req.on("data", (chunk: Buffer) => {
      bodySize += chunk.length;
      if (bodySize > BODY_LIMIT) {
        res.writeHead(413, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Payload too large" }));
        req.destroy();
        return;
      }
      body += chunk.toString();
    });
    req.on("end", () => {
      if (res.headersSent) return;
      // Respond immediately — async processing must not block commit (F-43)
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));

      // Process asynchronously
      handleGitEvent(body, skipKeyword, fileService, ollamaService, embeddingService, logger).catch((err: unknown) => {
        // Log but do not propagate (F-44)
        logger("error", "git-event processing failed", { error: String(err) });
        process.stderr.write(`[project-memory] git-event error: ${String(err)}\n`);
      });
    });
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      logger("warn", "git hook port in use — hook integration disabled", { port });
      process.stderr.write(`[project-memory] Port ${port} already in use — git hook integration disabled\n`);
    } else {
      logger("error", "git hook HTTP server error", { error: err.message });
      process.stderr.write(`[project-memory] HTTP server error: ${err.message}\n`);
    }
  });

  server.listen(port, "127.0.0.1", () => {
    logger("info", "git hook server listening", { port });
  });
  return {
    close: () => server.close(),
  };
}

async function handleGitEvent(
  body: string,
  skipKeyword: string,
  fileService: FileService,
  ollamaService: OllamaService,
  embeddingService: EmbeddingService,
  logger: Logger,
): Promise<void> {
  let event: GitEvent;
  try {
    event = JSON.parse(body) as GitEvent;
  } catch {
    return; // Invalid JSON — ignore
  }

  // Validate required fields with type guards
  if (typeof event.event !== "string" || typeof event.message !== "string") return;
  if (!event.event || !event.message) return;

  // Skip if message contains skip keyword (F-42)
  if (event.message.includes(skipKeyword)) return;

  logger("info", "git-event received", { message: event.message, files: event.changed_files?.length ?? 0 });

  const diff = typeof event.diff === "string" ? event.diff : "";
  const text = `${event.message}\n\n${diff}`;
  const summaries = await summarizeCommit(ollamaService, text, event.message);

  let anyWritten = false;
  for (const [scope, summary] of Object.entries(summaries) as [MemoryScope, string | null][]) {
    if (!summary) continue;
    const written = fileService.append(scope, summary);
    anyWritten = true;
    logger("info", "memory updated", { scope });

    // Auto-embed the new entry (F-32)
    const sections = parseMarkdownSections(written, scope);
    for (const section of sections) {
      const id = contentId(scope, section.section, section.content);
      await embeddingService.embed(id, scope, section.section, section.content).catch(() => {});
    }
  }

  // Auto-commit updated memory files so they're versioned alongside the triggering commit
  // Use [skip-memory] to prevent the hook from re-triggering on this commit
  if (anyWritten) {
    await autoCommitMemory(skipKeyword)
      .then(() => logger("info", "memory files auto-committed"))
      .catch((err: unknown) => {
        logger("error", "auto-commit failed", { error: String(err) });
        process.stderr.write(`[project-memory] git-hook auto-commit failed: ${String(err)}\n`);
      });
  } else {
    logger("info", "git-event processed — no memory changes", { message: event.message });
  }
}
