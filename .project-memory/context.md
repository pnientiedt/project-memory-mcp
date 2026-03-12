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
- **Testing:** Vitest ^1.3, 101 tests, ~83% line coverage target
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
- **Tests:** Vitest, table-driven where possible. Test file next to source (`foo.ts` → `foo.test.ts`). 101 tests, ~83% line coverage is the current baseline.
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
- **Version:** 0.3.0 (as of 2026-03-13). Epics `scaile-*` (initial build) and `pmm-*` (ongoing) tracked in Beads.
- **Key completed epics:** `scaile-*` (full initial implementation + npm packaging), `pmm-sks` (upsert support for write tools + FileService).
- **Known sensitive areas:** `hooks/post-commit` shell script has had injection vulnerabilities fixed — do not simplify it; `src/services/summarization.ts` Ollama prompts are carefully calibrated — change cautiously.
- **Issue tracking:** Beads (`bd` CLI), prefix `pmm-*`.
