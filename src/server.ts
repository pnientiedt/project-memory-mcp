import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadConfig } from "./config.js";
import { FileService } from "./services/file.js";
import { EmbeddingService } from "./services/embedding.js";
import { OllamaService } from "./services/ollama.js";
import { registerMemoryResources } from "./resources/memory.js";
import { registerWriteTools } from "./tools/write.js";
import { registerReadTools } from "./tools/read.js";
import { registerAdminTools } from "./tools/admin.js";
import { startGitHookServer } from "./triggers/git-hook.js";
import { startWatcher } from "./triggers/watcher.js";
import { SessionManager } from "./triggers/session.js";
import type { ServerConfig } from "./types.js";

export interface ProjectMemoryServer {
  mcp: McpServer;
  fileService: FileService;
  embeddingService: EmbeddingService;
  ollamaService: OllamaService;
  sessionManager: SessionManager;
  config: ServerConfig;
  close: () => Promise<void>;
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
  const sessionManager = new SessionManager(config.session, fileService);

  const mcp = new McpServer(
    { name: "@pnientiedt/project-memory-mcp", version: "0.1.0" },
    {
      capabilities: {
        resources: {},
        tools: {},
      },
    },
  );

  registerMemoryResources(mcp, fileService);
  registerWriteTools(mcp, fileService, embeddingService, sessionManager);
  registerReadTools(mcp, fileService, embeddingService, sessionManager);
  registerAdminTools(mcp, fileService, embeddingService);

  let stopGitHook: (() => void) | undefined;
  if (config.git.hook_enabled) {
    const hookServer = startGitHookServer(
      config.git.hook_port,
      config.git.skip_keyword,
      fileService,
      ollamaService,
      embeddingService,
    );
    stopGitHook = hookServer.close.bind(hookServer);
  }

  let stopWatcher: (() => Promise<void>) | undefined;
  if (config.watcher.enabled) {
    const watcherHandle = startWatcher(config.watcher, fileService, ollamaService, embeddingService);
    stopWatcher = watcherHandle.close.bind(watcherHandle);
  }

  const close = async () => {
    sessionManager.close();
    stopGitHook?.();
    await stopWatcher?.();
    embeddingService.close();
    await mcp.close();
  };

  return { mcp, fileService, embeddingService, ollamaService, sessionManager, config, close };
}
