import chokidar from "chokidar";
import { resolve, relative, dirname } from "path";
import { readFileSync } from "fs";
import type { OllamaService } from "../services/ollama.js";
import type { FileService } from "../services/file.js";
import type { EmbeddingService } from "../services/embedding.js";
import { parseMarkdownSections, contentId } from "../services/embedding.js";
import { summarizeForScope } from "../services/summarization.js";
import type { WatcherConfig } from "../types.js";

export function startWatcher(
  config: WatcherConfig,
  fileService: FileService,
  ollamaService: OllamaService,
  embeddingService: EmbeddingService,
): { close: () => Promise<void> } {
  const baseDir = resolve(process.cwd());
  const memoryDir = dirname(resolve(fileService.getPath("context")));
  const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  const watcher = chokidar.watch(config.paths, {
    ignoreInitial: true,
    ignored: [
      // Ignore .project-memory/ directory entirely (F-62)
      (path: string) => {
        const abs = resolve(path);
        return abs.startsWith(memoryDir);
      },
    ],
    persistent: true,
    usePolling: false,
  });

  const handleChange = (filePath: string) => {
    // Path traversal protection — use resolved path consistently
    const abs = resolve(filePath);
    if (!abs.startsWith(baseDir)) return;

    // Clear existing debounce for this file (keyed on resolved path)
    const existing = debounceTimers.get(abs);
    if (existing) clearTimeout(existing);

    // Debounce: wait for last change before processing (F-61)
    const timer = setTimeout(() => {
      debounceTimers.delete(abs);
      processFile(abs, fileService, ollamaService, embeddingService).catch((err: unknown) => {
        process.stderr.write(`[project-memory] watcher error for ${abs}: ${String(err)}\n`);
      });
    }, config.debounce_ms);

    debounceTimers.set(abs, timer);
  };

  watcher.on("change", handleChange);
  watcher.on("add", handleChange);

  return {
    close: async () => {
      for (const timer of debounceTimers.values()) clearTimeout(timer);
      await watcher.close();
    },
  };
}

async function processFile(
  filePath: string,
  fileService: FileService,
  ollamaService: OllamaService,
  embeddingService: EmbeddingService,
): Promise<void> {
  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    return; // File deleted or unreadable
  }

  const relPath = relative(process.cwd(), filePath);
  const summary = await summarizeForScope(ollamaService, `File: ${relPath}\n\n${content}`, "context");

  const written = fileService.append("context", summary);

  // Auto-embed
  const sections = parseMarkdownSections(written, "context");
  for (const section of sections) {
    const id = contentId("context", section.section, section.content);
    await embeddingService.embed(id, "context", section.section, section.content).catch(() => {});
  }
}
