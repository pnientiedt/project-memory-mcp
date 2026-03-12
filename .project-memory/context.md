# Domain Context

This file stores domain knowledge, conventions, and context.

## stack (2026-03-12)

TypeScript/Node.js (>=20) package published as @pnientiedt/project-memory-mcp. Core runtime deps: @modelcontextprotocol/sdk (MCP transport), @huggingface/transformers (ONNX embeddings, all-MiniLM-L6-v2), better-sqlite3 (embedding store), chokidar (filesystem watcher), simple-git (git integration), zod (config validation). Dev: vitest, tsx, typescript-eslint. Build output: dist/. No cloud dependencies — fully offline by design.

## architecture (2026-03-12)

Stdio-based MCP server with 4 memory scopes stored as Markdown files in .project-memory/ (decisions.md, tech_debt.md, progress.md, context.md). Claude reads these via MCP Resources (memory://decisions etc.) automatically at session start. Claude writes via MCP Tools (add_decision, log_tech_debt, update_progress, add_context). Semantic search uses transformers.js pipeline + cosine similarity stored in SQLite (.project-memory/embeddings.db, excluded from git). Git hook integration: a shell script at .git/hooks/post-commit POSTs commit diff to a local HTTP server (port 47832) on the MCP process, which sends text through Ollama for summarization and auto-commits updated .md files with [skip-memory] to prevent re-triggering.

## conventions (2026-03-12)

Conventional commits required (feat/fix/refactor/docs/test/chore). Include beads issue ID in scope when applicable (e.g. feat(bd-abc): ...). All source and docs in English. Vitest for tests (table-driven where applicable). 79 tests at 83% line coverage. Atomic writes via tmp+rename. Idempotency via SHA256 hash to prevent duplicate memory entries. TypeScript strict mode. ESLint with typescript-eslint.

## deployment (2026-03-12)

Published to npm as @pnientiedt/project-memory-mcp (scoped because 'project-memory-mcp' was already taken). npx @pnientiedt/project-memory-mcp init is the primary onboarding path. GitHub Actions workflow publishes on v* tags. NPM_TOKEN stored as GitHub secret. Short alias 'pmm' provided as second bin entry. files field in package.json: dist/, hooks/, commands/.

## project (2026-03-12)

Personal-first tool built to solve Claude's session amnesia in long development projects. Built in a single day (2026-03-12) using Beads issue tracking and Ralph Loop automation. Offline-first is a permanent design constraint — no cloud LLM support planned. 4 memory scopes (decisions, tech_debt, progress, context) are fixed by design for simplicity; users adapt their content to the scopes. May be shared as open source if the tool proves useful beyond personal use.
