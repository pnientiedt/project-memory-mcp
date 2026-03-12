# Technical Debt

This file tracks known technical debt and issues.

<!-- date:2026-03-12 hash:td002 -->
## Tech Debt [LOW]

`hook_port` in config.yaml does not auto-sync to the installed hook. The hook reads `PMM_HOOK_PORT` at runtime (defaulting to 47832), so users can override via env var without reinstalling. However, changing `hook_port` in config.yaml alone has no effect — users must also set `PMM_HOOK_PORT` in their shell. The config comment documents this but the coupling is confusing.

**Affected Files:** src/index.ts (init function), hooks/post-commit

<!-- date:2026-03-12 hash:td003 -->
## Tech Debt [LOW]

`progress.md` accumulates empty 0-minute session summaries. Claude Code frequently starts and stops the MCP server during probing/reconnection, each time triggering `onSessionEnd()` with 0 tool calls and 0 duration. These entries are valid but noisy — they add no useful information.

**Affected Files:** src/triggers/session.ts
<!-- date:2026-03-12 hash:a690c36c83c3 -->
## Tech Debt [MEDIUM]

Windows native git hooks not supported

**Affected Files:** hooks/post-commit
<!-- date:2026-03-12 hash:4747a16cadaa -->
## Tech Debt [LOW]

No vector extension in SQLite — cosine similarity is computed in JavaScript by loading all vectors into memory. This works up to ~10,000 entries but will degrade at scale. A proper vector extension (e.g., sqlite-vss) would be needed for larger knowledge bases.

**Affected Files:** src/services/embedding.ts, src/services/db.ts
