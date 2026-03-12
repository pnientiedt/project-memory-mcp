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

const { mcp, config } = createServer();

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
process.on("SIGTERM", () => {
  log("info", "Received SIGTERM, shutting down");
  logStream.end();
  mcp.close().then(() => process.exit(0));
});

process.on("SIGINT", () => {
  log("info", "Received SIGINT, shutting down");
  logStream.end();
  mcp.close().then(() => process.exit(0));
});

log("info", "Starting project-memory-mcp server", { version: "0.1.0" });

const transport = new StdioServerTransport();
await mcp.connect(transport);

log("info", "Server started and connected via stdio");

async function runInit(): Promise<void> {
  const { writeFileSync, existsSync: exists, readFileSync: readFile } = await import("fs");
  const { createServer: create } = await import("./server.js");

  create(); // initializes .project-memory/

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

  if (exists(hookPath)) {
    // Chain: prepend our hook before existing hook (F-40)
    const existing = readFile(hookPath, "utf-8");
    if (existing.includes("project-memory-mcp")) {
      process.stdout.write("Hook already installed.\n");
      return;
    }
    const chained = hookScript + "\n# Original hook:\n" + existing;
    writeFileSync(hookPath, chained, { mode: 0o755 });
    process.stdout.write("Hook installed (chained with existing hook).\n");
  } else {
    writeFileSync(hookPath, hookScript, { mode: 0o755 });
    process.stdout.write("Hook installed at .git/hooks/post-commit\n");
  }

  process.stdout.write("project-memory-mcp initialized.\n");
}
