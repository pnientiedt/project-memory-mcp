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
      description: "Saves an architectural decision (ADR) to the persistent knowledge base",
      inputSchema: {
        title: z.string().describe("Short title of the decision"),
        context: z.string().describe("Problem / background situation"),
        decision: z.string().describe("The decision that was made"),
        consequences: z.string().optional().describe("Consequences and trade-offs"),
        status: z.enum(["proposed", "accepted", "deprecated"]).default("accepted"),
      },
    },
    async ({ title, context, decision, consequences, status }) => {
      const entry = [
        `## ${title}`,
        ``,
        `**Status:** ${status}`,
        `**Context:** ${context}`,
        `**Decision:** ${decision}`,
        consequences ? `**Consequences:** ${consequences}` : "",
      ].filter(Boolean).join("\n");

      const written = fileService.append("decisions", entry);
      await autoEmbed("decisions", title, entry);
      return {
        content: [{ type: "text" as const, text: `Decision saved:\n\n${written}` }],
      };
    },
  );

  // log_tech_debt (F-21)
  server.registerTool(
    "log_tech_debt",
    {
      description: "Records technical debt or known issues",
      inputSchema: {
        description: z.string().describe("Description of the technical debt"),
        severity: z.enum(["low", "medium", "high", "critical"]),
        affected_files: z.array(z.string()).optional().describe("Affected files"),
        ticket: z.string().optional().describe("Optional issue reference"),
      },
    },
    async ({ description, severity, affected_files, ticket }) => {
      const lines = [
        `## Tech Debt [${severity.toUpperCase()}]`,
        ``,
        description,
      ];
      if (affected_files && affected_files.length > 0) {
        lines.push(``, `**Affected Files:** ${affected_files.join(", ")}`);
      }
      if (ticket) {
        lines.push(`**Ticket:** ${ticket}`);
      }
      const entry = lines.join("\n");
      const written = fileService.append("tech_debt", entry);
      await autoEmbed("tech_debt", `Tech Debt [${severity}]`, entry);
      return {
        content: [{ type: "text" as const, text: `Tech debt recorded:\n\n${written}` }],
      };
    },
  );

  // update_progress (F-22)
  server.registerTool(
    "update_progress",
    {
      description: "Updates project progress with a milestone or status change",
      inputSchema: {
        milestone: z.string().describe("Name of the milestone"),
        status: z.enum(["planned", "in-progress", "done", "blocked"]),
        description: z.string().optional().describe("Optional details"),
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
        content: [{ type: "text" as const, text: `Progress updated:\n\n${written}` }],
      };
    },
  );

  // add_context (F-23)
  server.registerTool(
    "add_context",
    {
      description: "Saves domain knowledge, conventions, or other freeform context",
      inputSchema: {
        content: z.string().describe("Context to save"),
        category: z.string().optional().describe("Category tag (e.g. 'api', 'domain', 'convention')"),
      },
    },
    async ({ content, category }) => {
      const header = category ? `## [${category}]` : "## Context";
      const entry = `${header}\n\n${content}`;
      const written = fileService.append("context", entry);
      await autoEmbed("context", category || "Context", entry);
      return {
        content: [{ type: "text" as const, text: `Context saved:\n\n${written}` }],
      };
    },
  );
}
