import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FileService } from "../services/file.js";
import type { EmbeddingService } from "../services/embedding.js";
import { parseMarkdownSections } from "../services/embedding.js";
import type { MemoryScope } from "../types.js";

const ALL_SCOPES: MemoryScope[] = ["decisions", "tech_debt", "progress", "context"];

export function registerAdminTools(
  server: McpServer,
  fileService: FileService,
  embeddingService: EmbeddingService,
): void {
  server.registerTool(
    "reindex_memory",
    {
      description: "Re-indexiert alle Memory-Dateien in der Embedding-Datenbank",
      inputSchema: {
        scope: z.enum(["all", "decisions", "tech_debt", "progress", "context"]).default("all"),
      },
    },
    async ({ scope }) => {
      const scopes: MemoryScope[] = scope === "all" ? ALL_SCOPES : [scope as MemoryScope];
      let total = 0;

      for (const s of scopes) {
        const content = fileService.read(s);
        if (!content) continue;

        embeddingService.clearScope(s);
        const sections = parseMarkdownSections(content, s);
        const count = await embeddingService.reindex(sections);
        total += count;
      }

      return {
        content: [{ type: "text" as const, text: `Re-indexiert: ${total} Abschnitte in ${scopes.join(", ")}.` }],
      };
    },
  );
}
