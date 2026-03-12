# Technical Debt

This file tracks known technical debt and issues.

<!-- date:2026-03-12 hash:td001 -->
## Tech Debt [MEDIUM]

Custom minimal YAML parser in `src/config.ts` (parseSimpleYaml). A comment in the source explicitly notes "For production use, replace with a proper YAML library." The parser handles flat key-value pairs and basic arrays but will silently misparse complex YAML (multi-line strings, nested arrays, anchors).

**Affected Files:** src/config.ts

<!-- date:2026-03-12 hash:td002 -->
## Tech Debt [MEDIUM]

Git hook port (47832) is hardcoded in the shell script written by `init`. The port is configurable via `PMM_HOOK_PORT` env var for the MCP server, but the already-installed `.git/hooks/post-commit` script always targets port 47832. Changing `hook_port` in config.yaml after `init` has no effect on the hook — user must manually reinstall.

**Affected Files:** src/index.ts (init function), hooks/post-commit

<!-- date:2026-03-12 hash:td003 -->
## Tech Debt [LOW]

`progress.md` accumulates empty 0-minute session summaries. Claude Code frequently starts and stops the MCP server during probing/reconnection, each time triggering `onSessionEnd()` with 0 tool calls and 0 duration. These entries are valid but noisy — they add no useful information.

**Affected Files:** src/triggers/session.ts
<!-- date:2026-03-12 hash:a690c36c83c3 -->
## Tech Debt [MEDIUM]

Windows native git hooks not supported

**Affected Files:** hooks/post-commit
<!-- date:2026-03-12 hash:af26f7469647 -->
## Tech Debt [MEDIUM]

Hook port conflict silently swallowed — if port 47832 is already in use (EADDRINUSE), the git hook integration fails silently; commit still succeeds but no memory update occurs. An EADDRINUSE handler was added but there is no user-visible warning when this happens.

**Affected Files:** src/triggers/git-hook.ts, hooks/post-commit
<!-- date:2026-03-12 hash:4747a16cadaa -->
## Tech Debt [LOW]

No vector extension in SQLite — cosine similarity is computed in JavaScript by loading all vectors into memory. This works up to ~10,000 entries but will degrade at scale. A proper vector extension (e.g., sqlite-vss) would be needed for larger knowledge bases.

**Affected Files:** src/services/embedding.ts, src/services/db.ts
<!-- date:2026-03-12 hash:d80fff8c0f82 -->
## Tech Debt [LOW]

Legacy .gitlab-ci.yml present alongside GitHub Actions workflows — the project migrated to GitHub but the GitLab CI file was not removed. It may cause confusion for contributors.

**Affected Files:** .gitlab-ci.yml
