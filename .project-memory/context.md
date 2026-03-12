# Domain Context

This file stores domain knowledge, conventions, and context.

<!-- date:2026-03-12 hash:8aaf0dfba14b -->
## [stack]

## Tech Stack

- **Runtime:** Node.js >= 20, TypeScript 5.3
- **MCP SDK:** `@modelcontextprotocol/sdk` ^1.0 — stdio transport
- **Embeddings:** `@huggingface/transformers` ^3.8 — `all-MiniLM-L6-v2` via ONNX/WASM, fully local
- **LLM:** Ollama (localhost:11434, default model `llama3.2`) — optional, keyword-fallback available
- **Database:** `better-sqlite3` ^12.6 in WAL mode — stores embedding vectors as BLOB
- **Filesystem watching:** `chokidar` ^3.6
- **Git integration:** `simple-git` ^3.27
- **Config validation:** `zod` ^3.22 + `js-yaml` ^4.1
- **Testing:** Vitest ^1.3, 97 tests, ~83% line coverage target
- **Build:** `tsc` → `dist/`, published as `@pnientiedt/project-memory-mcp` on npm
- **Package bin aliases:** `project-memory-mcp` and `pmm`
<!-- date:2026-03-12 hash:5f6c0f3bcb59 -->
## [architecture]

## Architecture Overview

`project-memory-mcp` is a stdio-based MCP server that gives Claude persistent memory across sessions. It is published as an npm package (`@pnientiedt/project-memory-mcp`) installed into any target project via `npx`.

### Core components

| Layer | File(s) | Responsibility |
|---|---|---|
| Entry point | `src/index.ts` | Stdio transport, init mode (uses FileService directly — not createServer) |
| MCP server | `src/server.ts` | Registers 4 resources + 7 tools, wires SessionManager |
| Resources | `src/resources/memory.ts` | `memory://decisions`, `memory://tech-debt`, `memory://progress`, `memory://context` |
| Write tools | `src/tools/write.ts` | `add_decision`, `log_tech_debt`, `update_progress`, `add_context` (with upsert support) |
| Read tools | `src/tools/read.ts` | `get_memory`, `search_memory` |
| Admin tools | `src/tools/admin.ts` | `reindex_memory` |
| File service | `src/services/file.ts` | Atomic read/write of `.project-memory/*.md` with mode 0o600; upsert deduplication |
| Embedding | `src/services/embedding.ts` | transformers.js wrapper, cosine similarity |
| SQLite | `src/services/db.ts` | WAL mode, schema for embedding vectors |
| Ollama | `src/services/ollama.ts` | HTTP client + keyword-extraction fallback |
| Summarization | `src/services/summarization.ts` | Per-category Ollama prompts (calibrated) |
| Git service | `src/services/git.ts` | simple-git integration |
| Memory commit | `src/services/memory-commit.ts` | Auto-commit `.project-memory/*.md` with `[skip-memory]` |
| Git hook trigger | `src/triggers/git-hook.ts` | HTTP server on port 47832 bound to 127.0.0.1 |
| Filesystem watcher | `src/triggers/watcher.ts` | chokidar, debounced, ignores `.project-memory/` |
| Session manager | `src/triggers/session.ts` | Inactivity timer → session summary in `progress.md`; guard against timer/close race |

### Memory files (versioned in git)

`.project-memory/decisions.md`, `tech_debt.md`, `progress.md`, `context.md`  
Excluded: `embeddings.db`, `server.log`

### Git hook data flow

`git commit` → `hooks/post-commit` (shell, sends env-vars not shell-interpolated) → `POST localhost:47832/internal/git-event` → Ollama summarize → write memory file → auto-commit `[skip-memory]`
<!-- date:2026-03-12 hash:109f943b04a9 -->
## [conventions]

## Development Conventions

- **Commits:** Conventional commits with beads issue refs — `feat(pmm-abc): ...`, `fix:`, `chore:`, `test:`. Append `[skip-memory]` to prevent the git hook from re-triggering on memory-only commits.
- **Tests:** Vitest, table-driven where possible. Test file next to source (`foo.ts` → `foo.test.ts`). 97 tests, ~83% line coverage is the current baseline.
- **Upsert pattern:** Write tools and FileService support an `upsert` flag (added in 0.2.0) to replace existing entries with the same description/title rather than appending duplicates.
- **Security standards:** HTTP hook server binds to 127.0.0.1 only (not 0.0.0.0); 1 MB body limit; `CHANGED_FILES`/`TIMESTAMP` passed via env vars not shell interpolation; memory files written with mode 0o600.
- **Language:** All user-facing strings, prompts, and docs must be in English (project was translated from German in early history).
- **Config:** Validated via Zod schema in `src/config.ts`; inline JSON arrays in YAML are supported (js-yaml, not hand-rolled parser).
- **Audience:** Public npm package — API stability, docs, and security matter for external users.
<!-- date:2026-03-12 hash:73f3254d2ee9 -->
## [deployment]

## Deployment & Runtime

- **Distribution:** Published to npm as `@pnientiedt/project-memory-mcp` (scoped public). Original name `project-memory-mcp` was already taken.
- **Install into a project:** `npx @pnientiedt/project-memory-mcp init` — idempotent, sets up config.yaml, .mcp.json, .gitignore, git hook, optionally pulls Ollama model.
- **Runtime:** Launched by Claude Code via `.mcp.json` using `npx @pnientiedt/project-memory-mcp` — no local install needed.
- **CI/CD:** GitHub Actions — `.github/workflows/agent.yml` (tests), `.github/workflows/publish.yml` (publishes on `v*` tags, strips `v` prefix before `npm version`).
- **Release script:** `npm run release` = typecheck → test → build → npm publish.
- **Platforms:** macOS (arm64, x86_64), Linux (Ubuntu 22.04+). Windows via WSL2 only — native Windows git hooks not supported.
- **Node.js requirement:** >= 20 LTS.
<!-- date:2026-03-12 hash:0ef7501e4313 -->
## [project]

## Project Context

- **Purpose:** Solve Claude Code's "session amnesia" — architectural decisions, tech debt, and progress are persisted across conversations in versioned Markdown files in the target project's `.project-memory/` directory.
- **Audience:** Public npm package targeting developers who use Claude Code. Not just a personal tool.
- **Core invariant:** Must be fully offline — no cloud API keys required at runtime. Ollama + transformers.js + SQLite all run locally.
- **Version:** 0.2.0 (as of 2026-03-12). Epics `scaile-*` (initial build) and `pmm-*` (ongoing) tracked in Beads.
- **Key completed epics:** `scaile-*` (full initial implementation + npm packaging), `pmm-sks` (upsert support for write tools + FileService).
- **Known sensitive areas:** `hooks/post-commit` shell script has had injection vulnerabilities fixed — do not simplify it; `src/services/summarization.ts` Ollama prompts are carefully calibrated — change cautiously.
- **Issue tracking:** Beads (`bd` CLI), prefix `pmm-*`.
<!-- date:2026-03-12 hash:daddcdd50041 -->
## Project Memory-MCP

### Overview

The project-memory-mcp is a persistent AI knowledge base for Claude via Model Context Protocol. It stores architectural decisions, technical debt, project progress, and domain knowledge in versioned Markdown files.

### Features

*   4 MCP Resources: Claude reads `memory://decisions`, `memory://tech-debt`, `memory://progress`, and `memory://context` automatically at session start.
*   7 MCP Tools: `add_decision`, `log_tech_debt`, `update_progress`, `add_context`, `get_memory`, `search_memory`, and `reindex_memory` for writing new entries.
*   Semantic Search: Embedding-based search via `@huggingface/transformers` (all-MiniLM-L6-v2) stored locally in SQLite.
*   Git Hook: Post-commit hook sends diff + message to Ollama for automatic summarization and auto-commits the updated memory files.
*   Filesystem Watcher: Changes to `CLAUDE.md`, `docs/adr/`, etc., trigger memory updates.
*   Session Summary: Inactivity timer writes a session summary to `progress.md`.
*   Ollama Fallback: Keyword extraction when Ollama is unavailable.

### Prerequisites

*   Node.js >= 20
*   [Ollama](https://ollama.ai) (optional, for automatic summarization)

### Installation

#### In a new project (recommended)

```bash
npx @pnientiedt/project-memory-mcp init
```

This sets up everything automatically, including creating `.project-memory/config.yaml` with documented defaults, adding `project-memory` entry to `.mcp.json`, updating `.gitignore` with database/log exclusions, installing the git post-commit hook, and pulling `llama3.2` if Ollama is running.

#### From source

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

### Usage

After startup Claude reads the memory files automatically. New entries are written via tools:

*   `add_decision`: Save an architectural decision (ADR format); upsert=true to replace existing.
*   `log_tech_debt`: Record technical debt; upsert=true to replace existing.
*   `update_progress`: Update a milestone; upsert=true to replace existing.
*   `add_context`: Save domain knowledge / conventions; upsert=true to replace existing.
*   `get_memory`: Read a memory file directly.
*   `search_memory`: Semantic search across the knowledge base.
*   `reindex_memory`: Rebuild the embedding index.

### Configuration

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

### Memory Files

Located in `.project-memory/` and versioned in git (except `embeddings.db` and `server.log`):

| File | Contents |
|------|----------|
| `decisions.md` | Architectural decisions (ADRs) |
| `tech_debt.md` | Technical debt |
| `progress.md` | Project progress & session summaries |
| `context.md` | Domain knowledge & conventions |

### Development

```bash
npm test              # Run tests (79 tests)
npm run test:coverage # Coverage report (83% line coverage)
npm run build         # Compile TypeScript
npm run typecheck     # Type check only
npm run release       # typecheck + test + build + npm publish
```

### Project Structure

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

This project is designed to be a persistent AI knowledge base for Claude via Model Context Protocol. It stores architectural decisions, technical debt, project progress, and domain knowledge in versioned Markdown files. The project includes various features such as semantic search, Git hooks, and a filesystem watcher to update the knowledge base automatically. The project structure is organized into different files and folders, each with their own specific functionality.
<!-- date:2026-03-12 hash:6d82d9f42ca9 -->
## Project Memory MCP

### Overview

Project Memory MCP is a persistent AI knowledge base for Claude, a project management tool, using the Model Context Protocol (MCP). This system stores architectural decisions, technical debt, project progress, and domain knowledge in versioned Markdown files, allowing for automatic reading and writing of data via MCP Resources and Tools.

### Features

* 4 MCP Resources: Automatically read `memory://decisions`, `memory://tech-debt`, `memory://progress`, and `memory://context` at session start.
* 7 MCP Tools: Provide commands for adding decisions, logging technical debt, updating progress, adding context, retrieving memory, searching memory, reindexing memory, and more.
* Semantic Search: Embedding-based search using `@huggingface/transformers` (all-MiniLM-L6-v2) stored locally in SQLite.
* Git Hook: Post-commit hook sends diff + message to Ollama for automatic summarization and auto-commits updated memory files.
* Filesystem Watcher: Triggers memory updates when changes are detected in `CLAUDE.md`, `docs/adr/`, etc.
* Session Summary: Writes a session summary to `progress.md` when inactivity timer expires.
* Ollama Fallback: Keyword extraction when Ollama is unavailable.

### Prerequisites

* Node.js 20 or higher
* Ollama (optional, for automatic summarization)

### Installation

#### In a new project (recommended)

```bash
npx @pnientiedt/project-memory-mcp init
```

This sets up everything automatically, including creating the `.project-memory/config.yaml` file, adding the project to the MCP server, and installing the git post-commit hook.

#### From source

```bash
npm install
npm run build
```

Register the MCP server in Claude Code by modifying the `.mcp.json` file.

### Usage

After startup, Claude reads the memory files automatically. New entries are written via the MCP Tools.

### Configuration

The configuration is stored in the `.project-memory/config.yaml` file. Environment variables can override the config.

### Memory Files

The memory files are located in the `.project-memory/` directory and are versioned in git (except `embeddings.db` and `server.log`).

### Development

```bash
npm test              # Run tests (79 tests)
npm run test:coverage # Coverage report (83% line coverage)
npm run build         # Compile TypeScript
npm run typecheck     # Type check only
npm run release       # typecheck + test + build + npm publish
```

### Project Structure

The project structure is organized as follows:

* `src/`: Source code
	+ `index.ts`: Entry point, stdio transport
	+ `server.ts`: MCP server factory
	+ `config.ts`: Load and validate configuration (zod)
	+ `types.ts`: Shared TypeScript types
	+ `resources/`: MCP resources (memory://)
	+ `tools/`: MCP tools
	+ `services/`: Services for managing memory files, embeddings, and more
	+ `triggers/`: Triggers for the git hook, watcher, and session summary
	+ `hooks/`: Shell script for the post-commit hook
```
