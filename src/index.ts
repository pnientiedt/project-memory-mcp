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

log("info", "Starting project-memory-mcp server", { version: "0.1.0" });

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
  const { createServer: create } = await import("./server.js");

  const step = (symbol: string, msg: string) =>
    process.stdout.write(`${symbol} ${msg}\n`);

  // Step 1: Initialize .project-memory/ directory and default memory files
  create();
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
  # Port the MCP server listens on for git events
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
  const hookScript = `#!/bin/sh
# project-memory-mcp post-commit hook
# Sends commit info to MCP server for memory update

COMMIT_MSG=$(git log -1 --pretty=%B)
DIFF=$(git diff HEAD~1 HEAD --stat 2>/dev/null || echo "")
CHANGED=$(git diff --name-only HEAD~1 HEAD 2>/dev/null | tr '\\n' ',' | sed 's/,$//')
TIMESTAMP=$(date +%s)

# Skip if [skip-memory] in commit message
echo "$COMMIT_MSG" | grep -q "\\[skip-memory\\]" && exit 0

# Send async to MCP server internal endpoint
curl -s -X POST http://localhost:47832/internal/git-event \\
  -H "Content-Type: application/json" \\
  -d "{\\"event\\":\\"post-commit\\",\\"message\\":$(echo "$COMMIT_MSG" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))'),\\"diff\\":$(echo "$DIFF" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))'),\\"changed_files\\":[\\"$CHANGED\\"],\\"timestamp\\":$TIMESTAMP}" &

exit 0
`;

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
  try {
    const res = await fetch("http://localhost:11434/api/tags", {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      step("✓", "Ollama is available — pulling llama3.2 model...");
      await new Promise<void>((resolve) => {
        const proc = spawn("ollama", ["pull", "llama3.2"], { stdio: "inherit" });
        proc.on("close", (code) => {
          if (code === 0) {
            step("✓", "ollama pull llama3.2 complete");
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
    step("↷", "Ollama not running — skipping model pull (run 'ollama pull llama3.2' later)");
  }

  step("✓", "project-memory-mcp initialized successfully");
  process.stdout.write(
    "\nNext: restart Claude Code to load the MCP server, then use add_decision, add_context, etc.\n"
  );
}
