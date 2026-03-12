import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadConfig } from "./config.js";
import { FileService } from "./services/file.js";
import { registerMemoryResources } from "./resources/memory.js";
import { registerWriteTools } from "./tools/write.js";
import { registerReadTools } from "./tools/read.js";
import type { ServerConfig } from "./types.js";

export interface ProjectMemoryServer {
  mcp: McpServer;
  fileService: FileService;
  config: ServerConfig;
}

export function createServer(configPath?: string): ProjectMemoryServer {
  const config = loadConfig(configPath);
  const fileService = new FileService(config);

  fileService.initializeDirectory();

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
  registerReadTools(mcp, fileService);

  return { mcp, fileService, config };
}
