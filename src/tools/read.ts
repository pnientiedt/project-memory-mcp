import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FileService } from "../services/file.js";
import type { MemoryScope } from "../types.js";

export function registerReadTools(server: McpServer, fileService: FileService): void {
  // get_memory: direct read access to a memory file
  server.registerTool(
    "get_memory",
    {
      description: "Liest den Inhalt einer Memory-Datei direkt",
      inputSchema: {
        scope: z.enum(["decisions", "tech_debt", "progress", "context"]).describe("Welche Memory-Datei lesen"),
      },
    },
    async ({ scope }) => {
      const content = fileService.read(scope as MemoryScope);
      return {
        content: [{ type: "text" as const, text: content || "(leer)" }],
      };
    },
  );

  // search_memory: keyword fallback until Phase 2 embedding is implemented
  server.registerTool(
    "search_memory",
    {
      description: "Semantische Suche in der gesamten Wissensbasis",
      inputSchema: {
        query: z.string().describe("Suchanfrage in natürlicher Sprache"),
        scope: z.enum(["decisions", "tech_debt", "progress", "context", "all"]).default("all"),
        top_k: z.number().int().min(1).max(20).default(5),
      },
    },
    async ({ query, scope, top_k }) => {
      // Keyword fallback until embedding is implemented (Phase 2)
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
        : `Keine Ergebnisse für "${query}" gefunden.`;

      return {
        content: [{ type: "text" as const, text }],
      };
    },
  );
}
