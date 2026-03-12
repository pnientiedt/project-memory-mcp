import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FileService } from "../services/file.js";
import type { MemoryScope } from "../types.js";

const MEMORY_RESOURCES: Array<{ scope: MemoryScope; uri: string; name: string; description: string }> = [
  {
    scope: "decisions",
    uri: "memory://decisions",
    name: "Architecture Decisions",
    description: "Architectural decision records (ADRs) for this project",
  },
  {
    scope: "tech_debt",
    uri: "memory://tech-debt",
    name: "Technical Debt",
    description: "Known technical debt and issues",
  },
  {
    scope: "progress",
    uri: "memory://progress",
    name: "Project Progress",
    description: "Project milestones and progress tracking",
  },
  {
    scope: "context",
    uri: "memory://context",
    name: "Domain Context",
    description: "Domain knowledge, conventions, and context",
  },
];

export function registerMemoryResources(server: McpServer, fileService: FileService): void {
  for (const resource of MEMORY_RESOURCES) {
    server.registerResource(
      resource.name,
      resource.uri,
      { description: resource.description, mimeType: "text/markdown" },
      async () => ({
        contents: [
          {
            uri: resource.uri,
            mimeType: "text/markdown",
            text: fileService.read(resource.scope),
          },
        ],
      }),
    );
  }
}
