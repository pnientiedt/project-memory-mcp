# Architecture Decisions

This file tracks architectural decisions (ADRs) for this project.

<!-- date:2026-03-12 hash:adr001 -->
## Local-only, offline-first architecture

**Status:** accepted
**Context:** Session-based AI assistants lose all context between conversations. Options were: (a) cloud-sync to a central database, (b) local files only.
**Decision:** All memory is stored locally in `.project-memory/` Markdown files. No cloud APIs, no external services required. Fully usable without internet.
**Consequences:** Cannot sync across machines by default. Git-versioning serves as the collaboration mechanism. The offline-first guarantee is a permanent constraint, not a limitation.

<!-- date:2026-03-12 hash:adr002 -->
## Markdown files as primary storage (not a database)

**Status:** accepted
**Context:** Memory could be stored in SQLite, JSON, or Markdown. Needed human-readability and git-versioning.
**Decision:** 4 Markdown files (decisions.md, tech_debt.md, progress.md, context.md) are the source of truth. SQLite is used only for the embedding index and is excluded from git.
**Consequences:** Memory is human-readable and diffable. Git history shows memory evolution. Embeddings are rebuilt on demand via `reindex_memory`. The 4-scope model is fixed — no user-defined scopes.

<!-- date:2026-03-12 hash:adr003 -->
## MCP stdio transport + local HTTP side-channel for git hook

**Status:** accepted
**Context:** MCP servers use stdio transport with Claude Code. But the git post-commit hook runs as a shell script — it cannot write to the MCP process's stdin.
**Decision:** Use stdio transport for the main MCP channel. Start a local HTTP server on port 47832 as a side-channel. The shell hook POSTs commit events to `http://localhost:47832/internal/git-event`.
**Consequences:** The MCP server must be running when commits are made for the hook to fire. If the server is not running, hook requests fail silently (fire-and-forget curl). Port is configurable via `PMM_HOOK_PORT` env var but hardcoded in the already-installed shell script.

<!-- date:2026-03-12 hash:adr004 -->
## Ollama for LLM summarization with keyword fallback

**Status:** accepted
**Context:** Automatic commit summarization requires an LLM. Cloud LLMs violate the offline-first constraint.
**Decision:** Use Ollama (default model: llama3.2) for commit summarization. Fall back to keyword extraction if Ollama is unavailable. Cloud LLM support is permanently out of scope.
**Consequences:** Full functionality requires Ollama installed. `init` pulls llama3.2 automatically if Ollama is running. Keyword fallback ensures some output is always produced even without Ollama.

<!-- date:2026-03-12 hash:adr005 -->
## @huggingface/transformers for local embeddings

**Status:** accepted
**Context:** Semantic search requires local embeddings. Two npm packages provide transformers.js: the older `@xenova/transformers` and the newer `@huggingface/transformers`.
**Decision:** Use `@huggingface/transformers` (v3.x) with `all-MiniLM-L6-v2` ONNX model. Downloaded on first use, cached locally.
**Consequences:** Works with Node.js 25+. No GPU required. Models cached in the npm global cache on first run.

<!-- date:2026-03-12 hash:adr006 -->
## Scoped npm package @pnientiedt/project-memory-mcp

**Status:** accepted
**Context:** The name `project-memory-mcp` was already taken on npm.
**Decision:** Publish as `@pnientiedt/project-memory-mcp` with `publishConfig.access: public`. Provide `pmm` as a short bin alias.
**Consequences:** Users run: `npx @pnientiedt/project-memory-mcp init`. The scoping is permanent — the original name is unavailable.

<!-- date:2026-03-12 hash:adr007 -->
## Idempotent writes via SHA256 content hash

**Status:** accepted
**Context:** Claude may call write tools multiple times with the same content, or the git hook may fire multiple times.
**Decision:** Every append is guarded by a SHA256 hash stored in an HTML comment (`<!-- date:... hash:... -->`). Duplicate content is silently skipped.
**Consequences:** Write operations are safe to retry. Content-based deduplication — same content written at different times produces one entry.
<!-- date:2026-03-12 hash:fea7dda465e3 -->
## Stdio transport over HTTP for MCP server
**Status:** accepted
**Context:** MCP servers can communicate over stdio or HTTP. The project needed to integrate cleanly with Claude Code's `.mcp.json` launcher without requiring a persistent background process.
**Decision:** Use stdio transport (not HTTP) for the MCP server. Claude Code spawns the process via `npx` and communicates over stdin/stdout.
**Consequences:** Simple deployment — no port conflicts, no daemon management. But a separate internal HTTP server (port 47832, bound to 127.0.0.1) is still needed for the git post-commit hook since git hooks can't write to stdio of a running process.
<!-- date:2026-03-12 hash:cfb20b7fe726 -->
## Scoped npm package name @pnientiedt/project-memory-mcp
**Status:** accepted
**Context:** The desired package name `project-memory-mcp` was already taken on npm when the project was ready to publish.
**Decision:** Publish as `@pnientiedt/project-memory-mcp` (scoped public). Add `pmm` as a short bin alias alongside `project-memory-mcp`. Update init command and README to reference the scoped name.
**Consequences:** Users must use the scoped name in npx calls. The `pmm` alias helps ergonomics. All `.mcp.json` entries generated by `init` use the scoped name.
<!-- date:2026-03-12 hash:b2aa48b4a656 -->
## Local-only embeddings via transformers.js (all-MiniLM-L6-v2)
**Status:** accepted
**Context:** Semantic search requires vector embeddings. Cloud embedding APIs (OpenAI, Cohere) would require API keys and internet access, violating the offline-first invariant.
**Decision:** Use `@huggingface/transformers` with the `Xenova/all-MiniLM-L6-v2` ONNX model, running fully in-process via WASM. Vectors stored in SQLite (WAL mode) as BLOB. Keyword extraction as fallback when the model is unavailable.
**Consequences:** No internet required after first model download. WASM has some startup overhead. Cosine similarity search implemented in JS (no vector extension needed). Offline-first invariant is maintained.
<!-- date:2026-03-12 hash:edffb9902624 -->
## Git hook communicates via HTTP POST (not shell pipe)
**Status:** accepted
**Context:** The post-commit hook needs to send diff data to the running MCP server. The server uses stdio for MCP, so direct IPC is not available.
**Decision:** The MCP server opens a secondary HTTP server on port 47832 (configurable, bound to 127.0.0.1). The `hooks/post-commit` shell script uses `curl` to POST a JSON payload. `CHANGED_FILES` and `TIMESTAMP` are passed as environment variables to the Python/shell subprocess rather than interpolated into shell strings to prevent injection.
**Consequences:** Decoupled: hook runs asynchronously and does not block `git commit`. Security: injection vector eliminated. Risk: if the port is taken, the hook silently fails (logged, commit still succeeds). The hook has been hardened through multiple security fix iterations — do not simplify it.
<!-- date:2026-03-12 hash:0026f64cd366 -->
## Memory files are versioned Markdown in git
**Status:** accepted
**Context:** Memory could be stored in a database (Postgres, SQLite) or external service. The requirement was for team-wide shared context and offline use.
**Decision:** Store all knowledge in plain Markdown files (`.project-memory/*.md`) committed to the project's git repository. After every Ollama summarization or tool write, auto-commit the changed memory files with `[skip-memory]` in the message.
**Consequences:** Memory is diffable, reviewable in PRs, and naturally shared across team members. No separate sync mechanism needed. The `[skip-memory]` sentinel prevents the hook from recursing on its own auto-commits. `embeddings.db` and `server.log` are gitignored.
<!-- date:2026-03-12 hash:d382cdad997a -->
## Upsert support for write tools (v0.2.0)
**Status:** accepted
**Context:** Repeated tool calls (e.g., from recurring memory bootstrap) produced duplicate entries in memory files, polluting the knowledge base.
**Decision:** Add an `upsert` boolean flag to `add_decision`, `log_tech_debt`, `update_progress`, and `add_context`. When true, FileService replaces the existing entry with the same title/description heading rather than appending a new one.
**Consequences:** Idempotent writes — tools can be called multiple times without duplicates. Opt-in (default false) preserves backward compatibility. Implemented in `src/services/file.ts` and exposed via all 4 write tools.
