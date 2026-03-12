# project-memory-mcp

Persistent AI knowledge base for Claude via Model Context Protocol — fully offline, no cloud API key required.

Stores architectural decisions, technical debt, project progress, and domain knowledge in versioned Markdown files. Claude reads these files automatically via MCP Resources and writes new entries via MCP Tools.

## Features

- **4 MCP Resources** — Claude reads `memory://decisions`, `memory://tech-debt`, `memory://progress`, `memory://context` automatically at session start
- **7 MCP Tools** — `add_decision`, `log_tech_debt`, `update_progress`, `add_context`, `get_memory`, `search_memory`, `reindex_memory`
- **Semantic Search** — Embedding-based search via `@huggingface/transformers` (all-MiniLM-L6-v2) stored locally in SQLite
- **Git Hook** — Post-commit hook sends diff + message to Ollama for automatic summarization and auto-commits the updated memory files
- **Filesystem Watcher** — Changes to `CLAUDE.md`, `docs/adr/`, etc. trigger memory updates
- **Session Summary** — Inactivity timer writes a session summary to `progress.md`
- **Ollama Fallback** — Keyword extraction when Ollama is unavailable

## Prerequisites

- Node.js >= 20
- [Ollama](https://ollama.ai) (optional, for automatic summarization)

```bash
ollama pull llama3.2
```

## Installation

### In a new project (recommended)

```bash
npx @pnientiedt/project-memory-mcp init
```

This sets up everything automatically:
- Creates `.project-memory/config.yaml` with documented defaults
- Adds `project-memory` entry to `.mcp.json`
- Updates `.gitignore` with database/log exclusions
- Installs the git post-commit hook
- Pulls `llama3.2` if Ollama is running

### From source

```bash
npm install
npm run build
```

Register the MCP server in Claude Code (`.mcp.json` already pre-configured):

```json
{
  "mcpServers": {
    "project-memory": {
      "command": "npx",
      "args": ["@pnientiedt/project-memory-mcp"]
    }
  }
}
```

## Usage

After startup Claude reads the memory files automatically. New entries are written via tools:

```
add_decision    — Save an architectural decision (ADR format); upsert=true to replace existing
log_tech_debt   — Record technical debt; upsert=true to replace existing
update_progress — Update a milestone; upsert=true to replace existing
add_context     — Save domain knowledge / conventions; upsert=true to replace existing
get_memory      — Read a memory file directly
search_memory   — Semantic search across the knowledge base
reindex_memory  — Rebuild the embedding index
```

## Configuration

`.project-memory/config.yaml` (created with defaults on first run):

```yaml
ollama:
  base_url: "http://localhost:11434"
  model: "llama3.2"
  timeout_seconds: 60
  fallback_to_keywords: true

embeddings:
  model: "Xenova/all-MiniLM-L6-v2"
  db_path: ".project-memory/embeddings.db"

git:
  hook_enabled: true
  hook_port: 47832
  skip_keyword: "[skip-memory]"

watcher:
  enabled: true
  paths: ["CLAUDE.md", "docs/adr/", "README.md"]
  debounce_ms: 2000

session:
  inactivity_timeout_minutes: 30
  summarize_on_end: true
```

Environment variables override config:

| Variable | Overrides |
|----------|-----------|
| `PMM_OLLAMA_URL` | `ollama.base_url` |
| `PMM_OLLAMA_MODEL` | `ollama.model` |
| `PMM_HOOK_PORT` | `git.hook_port` |
| `PMM_LOG_LEVEL` | `logging.level` |

## Memory Files

Located in `.project-memory/` and versioned in git (except `embeddings.db` and `server.log`):

| File | Contents |
|------|----------|
| `decisions.md` | Architectural decisions (ADRs) |
| `tech_debt.md` | Technical debt |
| `progress.md` | Project progress & session summaries |
| `context.md` | Domain knowledge & conventions |

## Development

```bash
npm test              # Run tests (101 tests)
npm run test:coverage # Coverage report (83% line coverage)
npm run build         # Compile TypeScript
npm run typecheck     # Type check only
npm run release       # typecheck + test + build + npm publish
```

## Project Structure

```
src/
  index.ts              # Entry point, stdio transport
  server.ts             # MCP server factory
  config.ts             # Load & validate configuration (zod)
  types.ts              # Shared TypeScript types
  resources/
    memory.ts           # MCP resources (memory://)
  tools/
    write.ts            # add_decision, log_tech_debt, update_progress, add_context
    read.ts             # get_memory, search_memory
    admin.ts            # reindex_memory
  services/
    file.ts             # Atomic read/write of memory files
    embedding.ts        # transformers.js + cosine similarity
    db.ts               # SQLite schema (WAL mode)
    ollama.ts           # Ollama HTTP client + keyword fallback
    summarization.ts    # Prompts per memory category
    git.ts              # simple-git integration
  triggers/
    git-hook.ts         # HTTP server for post-commit hook
    watcher.ts          # Filesystem watcher (chokidar)
    session.ts          # Inactivity timer & session summary
hooks/
  post-commit           # Shell script for git hook
```
