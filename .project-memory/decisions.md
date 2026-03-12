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

<!-- date:2026-03-12 hash:d382cdad997a -->
## Upsert support for write tools (v0.2.0)
**Status:** accepted
**Context:** Repeated tool calls (e.g., from recurring memory bootstrap) produced duplicate entries in memory files, polluting the knowledge base.
**Decision:** Add an `upsert` boolean flag to `add_decision`, `log_tech_debt`, `update_progress`, and `add_context`. When true, FileService replaces the existing entry with the same title/description heading rather than appending a new one.
**Consequences:** Idempotent writes — tools can be called multiple times without duplicates. Opt-in (default false) preserves backward compatibility. Implemented in `src/services/file.ts` and exposed via all 4 write tools.
