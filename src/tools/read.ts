import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FileService } from "../services/file.js";
import type { EmbeddingService } from "../services/embedding.js";
import type { SessionManager } from "../triggers/session.js";
import type { MemoryScope } from "../types.js";

export function registerReadTools(
  server: McpServer,
  fileService: FileService,
  embeddingService?: EmbeddingService,
  sessionManager?: SessionManager,
): void {
  // get_memory: direct read access to a memory file
  server.registerTool(
    "get_memory",
    {
      description: "Reads the contents of a memory file directly",
      inputSchema: {
        scope: z.enum(["decisions", "tech_debt", "progress", "context"]).describe("Which memory file to read"),
      },
    },
    async ({ scope }) => {
      sessionManager?.recordActivity("get_memory");
      const content = fileService.read(scope as MemoryScope);
      return {
        content: [{ type: "text" as const, text: content || "(empty)" }],
      };
    },
  );

  // search_memory: semantic search (F-30–F-33) with keyword fallback
  server.registerTool(
    "search_memory",
    {
      description: "Semantic search across the entire knowledge base",
      inputSchema: {
        query: z.string().describe("Search query in natural language"),
        scope: z.enum(["decisions", "tech_debt", "progress", "context", "all"]).default("all"),
        top_k: z.number().int().min(1).max(20).default(5),
      },
    },
    async ({ query, scope, top_k }) => {
      sessionManager?.recordActivity("search_memory");
      if (embeddingService) {
        // Semantic search via embeddings (F-30, F-31, F-33)
        const results = await embeddingService.search(query, scope as MemoryScope | "all", top_k);
        if (results.length === 0) {
          return { content: [{ type: "text" as const, text: `No results found for "${query}".` }] };
        }
        const text = results
          .map(r => `**[${r.source_file}/${r.section}]** (score: ${r.score.toFixed(3)})\n${r.content}`)
          .join("\n\n---\n\n");
        return { content: [{ type: "text" as const, text }] };
      }

      // Keyword fallback when embedding service not available
      const scopes: MemoryScope[] = scope === "all"
        ? ["decisions", "tech_debt", "progress", "context"]
        : [scope as MemoryScope];

      const results: string[] = [];
      for (const s of scopes) {
        const content = fileService.read(s);
        const lines = content.split("\n");
        const queryLower = query.toLowerCase();
        const matches = lines
          .filter(l => l.toLowerCase().includes(queryLower))
          .slice(0, top_k);
        if (matches.length > 0) {
          results.push(`**[${s}]**\n${matches.join("\n")}`);
        }
      }

      const text = results.length > 0
        ? results.join("\n\n")
        : `No results found for "${query}".`;

      return { content: [{ type: "text" as const, text }] };
    },
  );
}
