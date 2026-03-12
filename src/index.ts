#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { createWriteStream } from "fs";
import { existsSync, mkdirSync } from "fs";

// Handle init subcommand: npx project-memory-mcp init
if (process.argv[2] === "init") {
  await runInit();
  process.exit(0);
}

const server = createServer();
const { mcp, config } = server;

// Structured JSON logging to file (F-04)
const logDir = config.memory.base_dir;
if (!existsSync(logDir)) {
  mkdirSync(logDir, { recursive: true });
}
const logStream = createWriteStream(config.logging.file, { flags: "a" });

function log(level: string, message: string, data?: unknown): void {
  const entry = JSON.stringify({ ts: new Date().toISOString(), level, message, ...(data ? { data } : {}) });
  logStream.write(entry + "\n");
}

// Graceful shutdown (F-05)
const shutdown = () => {
  log("info", "Shutting down gracefully");
  server.close().then(() => {
    logStream.end();
    process.exit(0);
  });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

log("info", "Starting project-memory-mcp server", { version: "0.2.0" });

const transport = new StdioServerTransport();
await mcp.connect(transport);

log("info", "Server started and connected via stdio");

async function runInit(): Promise<void> {
  const {
    writeFileSync,
    existsSync: exists,
    readFileSync: readFile,
    mkdirSync: mkdir,
  } = await import("fs");
  const { spawn } = await import("child_process");
  const { fileURLToPath } = await import("url");
  const { dirname, join } = await import("path");

  const step = (symbol: string, msg: string) =>
    process.stdout.write(`${symbol} ${msg}\n`);

  // Compute package root early — used for hooks and commands below
  const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));

  // Step 1: Initialize .project-memory/ directory and default memory files
  // Use FileService directly to avoid leaking HTTP server / watcher / SQLite handles
  const { loadConfig } = await import("./config.js");
  const { FileService } = await import("./services/file.js");
  const cfg = loadConfig();
  new FileService(cfg).initializeDirectory();
  step("✓", ".project-memory/ initialized");

  // Step 2: Write config.yaml with fully commented defaults (F-95)
  const configPath = ".project-memory/config.yaml";
  if (!exists(configPath)) {
    const configYaml = `# project-memory-mcp configuration
# All values shown are defaults — uncomment and change as needed.

ollama:
  # URL of the running Ollama instance
  base_url: "http://localhost:11434"
  # Model used for commit summarization
  model: "llama3.2"
  # Request timeout in seconds
  timeout_seconds: 60
  # Fall back to keyword extraction if Ollama is unavailable
  fallback_to_keywords: true

embeddings:
  # Local model for semantic search (downloaded on first use via @huggingface/transformers)
  model: "Xenova/all-MiniLM-L6-v2"
  # SQLite database path (excluded from git by default)
  db_path: ".project-memory/embeddings.db"

git:
  # Enable post-commit hook integration
  hook_enabled: true
  # Port the MCP server listens on for git events.
  # IMPORTANT: if you change this, also set PMM_HOOK_PORT=<value> in your shell
  # environment (e.g. in .bashrc/.zshrc) so the post-commit hook sends to the
  # same port. The hook reads PMM_HOOK_PORT at runtime; this file only controls
  # the server's listening port.
  hook_port: 47832
  # Commits containing this string skip memory update
  skip_keyword: "[skip-memory]"

watcher:
  # Watch project files for changes and update memory automatically
  enabled: true
  # Paths/globs to watch (relative to project root)
  paths: ["CLAUDE.md", "docs/adr/", "README.md"]
  # Debounce delay in milliseconds
  debounce_ms: 2000

session:
  # Minutes of inactivity before session summary is written
  inactivity_timeout_minutes: 30
  # Write a session summary when the server shuts down
  summarize_on_end: true
`;
    writeFileSync(configPath, configYaml, "utf-8");
    step("✓", "config.yaml created with commented defaults");
  } else {
    step("↷", "config.yaml already exists — skipped");
  }

  // Step 3: Install git post-commit hook (F-40)
  const hookPath = ".git/hooks/post-commit";
  // Copy canonical hook from package — avoids dual-maintenance and JSON injection
  const hookSrc = join(packageRoot, "hooks", "post-commit");
  const hookScript = exists(hookSrc)
    ? readFile(hookSrc, "utf-8")
    : "#!/bin/sh\n# project-memory-mcp post-commit hook\nexit 0\n";

  if (exists(".git")) {
    if (!exists(".git/hooks")) {
      mkdir(".git/hooks", { recursive: true });
    }
    if (exists(hookPath)) {
      const existing = readFile(hookPath, "utf-8");
      if (existing.includes("project-memory-mcp")) {
        step("↷", "git post-commit hook already installed — skipped");
      } else {
        const chained = hookScript + "\n# Original hook:\n" + existing;
        writeFileSync(hookPath, chained, { mode: 0o755 });
        step("✓", "git post-commit hook installed (chained with existing hook)");
      }
    } else {
      writeFileSync(hookPath, hookScript, { mode: 0o755 });
      step("✓", "git post-commit hook installed at .git/hooks/post-commit");
    }
  } else {
    step("↷", "No .git directory found — skipping git hook");
  }

  // Step 4: Update .mcp.json — add project-memory server entry (F-96, F-97)
  const mcpJsonPath = ".mcp.json";
  const mcpEntry = {
    command: "npx",
    args: ["@pnientiedt/project-memory-mcp"],
  };
  let mcpConfig: { mcpServers?: Record<string, unknown> } = {};
  if (exists(mcpJsonPath)) {
    try {
      mcpConfig = JSON.parse(readFile(mcpJsonPath, "utf-8")) as typeof mcpConfig;
    } catch {
      mcpConfig = {};
    }
  }
  if (!mcpConfig.mcpServers) {
    mcpConfig.mcpServers = {};
  }
  if (mcpConfig.mcpServers["project-memory"]) {
    step("↷", ".mcp.json already has project-memory entry — skipped");
  } else {
    mcpConfig.mcpServers["project-memory"] = mcpEntry;
    writeFileSync(mcpJsonPath, JSON.stringify(mcpConfig, null, 2) + "\n", "utf-8");
    step("✓", ".mcp.json updated with project-memory server entry");
  }

  // Step 5: Update .gitignore — add project-memory exclusions (F-100, F-101)
  const gitignorePath = ".gitignore";
  const gitignoreLines = [
    "# project-memory-mcp: keep *.md, ignore db and logs",
    ".project-memory/embeddings.db",
    ".project-memory/server.log",
  ];
  let gitignoreContent = exists(gitignorePath)
    ? readFile(gitignorePath, "utf-8")
    : "";
  const missing = gitignoreLines.filter((l) => !gitignoreContent.includes(l));
  if (missing.length === 0) {
    step("↷", ".gitignore already has project-memory entries — skipped");
  } else {
    if (gitignoreContent && !gitignoreContent.endsWith("\n")) {
      gitignoreContent += "\n";
    }
    gitignoreContent += "\n" + missing.join("\n") + "\n";
    writeFileSync(gitignorePath, gitignoreContent, "utf-8");
    step("✓", ".gitignore updated with .project-memory/embeddings.db and server.log");
  }

  // Step 6: Pull Ollama model if Ollama is available (F-99)
  const ollamaUrl = cfg.ollama.base_url;
  const ollamaModel = cfg.ollama.model;
  try {
    const res = await fetch(`${ollamaUrl}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      step("✓", `Ollama is available — pulling ${ollamaModel} model...`);
      await new Promise<void>((resolve) => {
        const proc = spawn("ollama", ["pull", ollamaModel], { stdio: "inherit" });
        proc.on("close", (code) => {
          if (code === 0) {
            step("✓", `ollama pull ${ollamaModel} complete`);
          } else {
            step("!", `ollama pull exited with code ${code} — continuing`);
          }
          resolve();
        });
        proc.on("error", () => {
          step("!", "ollama CLI not found — skipping model pull");
          resolve();
        });
      });
    }
  } catch {
    step("↷", `Ollama not running — skipping model pull (run 'ollama pull ${ollamaModel}' later)`);
  }

  // Step 7: Install /init-memory Claude slash command
  const commandSrc = join(packageRoot, "commands", "init-project-memory.md");
  const commandDest = ".claude/commands/init-project-memory.md";
  if (exists(commandSrc)) {
    if (!exists(".claude/commands")) {
      mkdir(".claude/commands", { recursive: true });
    }
    if (exists(commandDest)) {
      step("↷", "/init-project-memory Claude command already installed — skipped");
    } else {
      writeFileSync(commandDest, readFile(commandSrc, "utf-8"), "utf-8");
      step("✓", "/init-project-memory Claude command installed at .claude/commands/init-project-memory.md");
    }
  }

  step("✓", "project-memory-mcp initialized successfully");
  process.stdout.write(
    "\nNext steps:\n" +
    "  1. Restart Claude Code to load the MCP server\n" +
    "  2. Run /init-project-memory to bootstrap memory from your git history\n"
  );
}
