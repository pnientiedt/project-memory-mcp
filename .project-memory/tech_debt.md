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
