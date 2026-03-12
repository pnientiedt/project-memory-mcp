import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FileService } from "../services/file.js";
import type { EmbeddingService } from "../services/embedding.js";
import { contentId } from "../services/embedding.js";
import type { MemoryScope } from "../types.js";

export function registerWriteTools(
  server: McpServer,
  fileService: FileService,
  embeddingService?: EmbeddingService,
): void {
  async function autoEmbed(scope: MemoryScope, section: string, content: string): Promise<void> {
    if (!embeddingService) return;
    const id = contentId(scope, section, content);
    await embeddingService.embed(id, scope, section, content).catch(() => {/* non-blocking */});
  }
  // add_decision (F-20)
  server.registerTool(
    "add_decision",
    {
      description: "Speichert eine Architekturentscheidung (ADR) in der persistenten Wissensbasis",
      inputSchema: {
        title: z.string().describe("Kurzer Titel der Entscheidung"),
        context: z.string().describe("Problem / Ausgangssituation"),
        decision: z.string().describe("Getroffene Entscheidung"),
        consequences: z.string().optional().describe("Konsequenzen und Trade-offs"),
        status: z.enum(["proposed", "accepted", "deprecated"]).default("accepted"),
      },
    },
    async ({ title, context, decision, consequences, status }) => {
      const entry = [
        `## ${title}`,
        ``,
        `**Status:** ${status}`,
        `**Kontext:** ${context}`,
        `**Entscheidung:** ${decision}`,
        consequences ? `**Konsequenzen:** ${consequences}` : "",
      ].filter(Boolean).join("\n");

      const written = fileService.append("decisions", entry);
      await autoEmbed("decisions", title, entry);
      return {
        content: [{ type: "text" as const, text: `Entscheidung gespeichert:\n\n${written}` }],
      };
    },
  );

  // log_tech_debt (F-21)
  server.registerTool(
    "log_tech_debt",
    {
      description: "Erfasst technische Schulden oder bekannte Probleme",
      inputSchema: {
        description: z.string().describe("Beschreibung der technischen Schuld"),
        severity: z.enum(["low", "medium", "high", "critical"]),
        affected_files: z.array(z.string()).optional().describe("Betroffene Dateien"),
        ticket: z.string().optional().describe("Optionale Issue-Referenz"),
      },
    },
    async ({ description, severity, affected_files, ticket }) => {
      const lines = [
        `## Tech Debt [${severity.toUpperCase()}]`,
        ``,
        description,
      ];
      if (affected_files && affected_files.length > 0) {
        lines.push(``, `**Betroffene Dateien:** ${affected_files.join(", ")}`);
      }
      if (ticket) {
        lines.push(`**Ticket:** ${ticket}`);
      }
      const entry = lines.join("\n");
      const written = fileService.append("tech_debt", entry);
      await autoEmbed("tech_debt", `Tech Debt [${severity}]`, entry);
      return {
        content: [{ type: "text" as const, text: `Tech Debt erfasst:\n\n${written}` }],
      };
    },
  );

  // update_progress (F-22)
  server.registerTool(
    "update_progress",
    {
      description: "Aktualisiert den Projektfortschritt mit einem Meilenstein oder einer Statusänderung",
      inputSchema: {
        milestone: z.string().describe("Name des Meilensteins"),
        status: z.enum(["planned", "in-progress", "done", "blocked"]),
        description: z.string().optional().describe("Optionale Details"),
      },
    },
    async ({ milestone, status, description }) => {
      const statusEmoji: Record<string, string> = {
        planned: "📋",
        "in-progress": "🔄",
        done: "✅",
        blocked: "🚫",
      };
      const lines = [
        `## ${statusEmoji[status]} ${milestone}`,
        ``,
        `**Status:** ${status}`,
      ];
      if (description) {
        lines.push(``, description);
      }
      const entry = lines.join("\n");
      const written = fileService.append("progress", entry);
      await autoEmbed("progress", milestone, entry);
      return {
        content: [{ type: "text" as const, text: `Fortschritt aktualisiert:\n\n${written}` }],
      };
    },
  );

  // add_context (F-23)
  server.registerTool(
    "add_context",
    {
      description: "Speichert Domain-Wissen, Konventionen oder sonstigen Freitext-Kontext",
      inputSchema: {
        content: z.string().describe("Zu speichernder Kontext"),
        category: z.string().optional().describe("Kategorie-Tag (z.B. 'api', 'domain', 'convention')"),
      },
    },
    async ({ content, category }) => {
      const header = category ? `## [${category}]` : "## Kontext";
      const entry = `${header}\n\n${content}`;
      const written = fileService.append("context", entry);
      await autoEmbed("context", category || "Kontext", entry);
      return {
        content: [{ type: "text" as const, text: `Kontext gespeichert:\n\n${written}` }],
      };
    },
  );
}
