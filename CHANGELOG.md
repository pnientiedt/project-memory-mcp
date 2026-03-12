# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-03-12

### Added
- 4 MCP Resources: `memory://decisions`, `memory://tech-debt`, `memory://progress`, `memory://context`
- 5 MCP Tools: `add_decision`, `log_tech_debt`, `update_progress`, `add_context`, `search_memory`, `reindex_memory`
- Semantic search via `@huggingface/transformers` (all-MiniLM-L6-v2) stored in SQLite
- Git post-commit hook integration with Ollama summarization
- Filesystem watcher (chokidar) for automatic memory updates
- Session inactivity timer with automatic summary on shutdown
- Ollama fallback to keyword extraction when unavailable
- `npx project-memory-mcp init` command for cross-project setup:
  - Creates `.project-memory/config.yaml` with documented defaults
  - Updates `.mcp.json` with server entry
  - Updates `.gitignore` with database/log exclusions
  - Pulls `llama3.2` model if Ollama is running
- Node.js >= 20 support (tested on Node 25 with native modules)
- 79 tests, 83% line coverage
