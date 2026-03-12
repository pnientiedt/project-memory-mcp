import { createServer as createHttpServer } from "http";
import { simpleGit } from "simple-git";
import type { FileService } from "../services/file.js";
import type { OllamaService } from "../services/ollama.js";
import type { EmbeddingService } from "../services/embedding.js";
import { summarizeCommit } from "../services/summarization.js";
import { parseMarkdownSections, contentId } from "../services/embedding.js";
import type { GitEvent, MemoryScope } from "../types.js";

export function startGitHookServer(
  port: number,
  skipKeyword: string,
  fileService: FileService,
  ollamaService: OllamaService,
  embeddingService: EmbeddingService,
): { close: () => void } {
  const server = createHttpServer((req, res) => {
    if (req.method !== "POST" || req.url !== "/internal/git-event") {
      res.writeHead(404);
      res.end();
      return;
    }

    let body = "";
    req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
    req.on("end", () => {
      // Respond immediately — async processing must not block commit (F-43)
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));

      // Process asynchronously
      handleGitEvent(body, skipKeyword, fileService, ollamaService, embeddingService).catch(() => {
        // Errors logged but never propagate (F-44)
      });
    });
  });

  server.listen(port);
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
): Promise<void> {
  let event: GitEvent;
  try {
    event = JSON.parse(body) as GitEvent;
  } catch {
    return; // Invalid JSON — ignore
  }

  // Validate required fields
  if (!event.message || !event.event) return;

  // Skip if message contains skip keyword (F-42)
  if (event.message.includes(skipKeyword)) return;

  const text = `${event.message}\n\n${event.diff}`;
  const summaries = await summarizeCommit(ollamaService, text, event.message);

  let anyWritten = false;
  for (const [scope, summary] of Object.entries(summaries) as [MemoryScope, string | null][]) {
    if (!summary) continue;
    const written = fileService.append(scope, summary);
    anyWritten = true;

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
    await autoCommitMemory(skipKeyword).catch(() => {});
  }
}

async function autoCommitMemory(skipKeyword: string): Promise<void> {
  const git = simpleGit(".");
  const status = await git.status();
  const memoryFiles = status.files
    .map((f) => f.path)
    .filter((p) => p.startsWith(".project-memory/") && p.endsWith(".md"));

  if (memoryFiles.length === 0) return;

  await git.add(memoryFiles);
  await git.commit(`chore: update project memory ${skipKeyword}`, memoryFiles, {
    "--no-verify": null,
  });
}
