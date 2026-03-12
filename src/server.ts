import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadConfig } from "./config.js";
import { FileService } from "./services/file.js";
import { EmbeddingService } from "./services/embedding.js";
import { OllamaService } from "./services/ollama.js";
import { registerMemoryResources } from "./resources/memory.js";
import { registerWriteTools } from "./tools/write.js";
import { registerReadTools } from "./tools/read.js";
import { registerAdminTools } from "./tools/admin.js";
import type { ServerConfig } from "./types.js";

export interface ProjectMemoryServer {
  mcp: McpServer;
  fileService: FileService;
  embeddingService: EmbeddingService;
  ollamaService: OllamaService;
  config: ServerConfig;
}

export function createServer(configPath?: string): ProjectMemoryServer {
  const config = loadConfig(configPath);
  const fileService = new FileService(config);

  fileService.initializeDirectory();

  const embeddingService = new EmbeddingService(
    config.embeddings.db_path,
    config.embeddings.model,
  );
  const ollamaService = new OllamaService(config.ollama);

  const mcp = new McpServer(
    { name: "project-memory-mcp", version: "0.1.0" },
    {
      capabilities: {
        resources: {},
        tools: {},
      },
    },
  );

  registerMemoryResources(mcp, fileService);
  registerWriteTools(mcp, fileService);
  registerReadTools(mcp, fileService, embeddingService);
  registerAdminTools(mcp, fileService, embeddingService);

  return { mcp, fileService, embeddingService, ollamaService, config };
}
