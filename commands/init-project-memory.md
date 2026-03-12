Bootstrap the project memory by analyzing the full git history and codebase, then populating the memory files with synthesized knowledge.

## Steps

### 1. Gather project signals (run in parallel)

- `git log --all --pretty=format:"--- COMMIT %h ---%n%ad%n%s%n%b" --date=short` — full commit history
- Read any of these that exist: `README.md`, `CLAUDE.md`, `docs/`, `package.json` / `go.mod` / `Cargo.toml` / `pyproject.toml`
- `git log --all --diff-filter=A --name-only --pretty=format:""` — list of files ever added (reveals structure evolution)
- List the top-level directory to understand project shape

### 2. Ask 3 targeted questions

Based on what you've read, identify the 3 most important things you still don't know about the project. Ask them all at once. Good candidates:

- Who uses this? (internal tool, external customers, developers)
- What's the most important invariant or constraint? (e.g. "must be offline-first", "latency < 100ms")
- Are there known problem areas the team wants to avoid touching?
- What conventions aren't captured in code? (naming, review process, branching)

### 3. Synthesize and write memory

Use the MCP tools to write structured entries. **Do not dump raw git log — synthesize patterns.**

**`add_context`** — write 3–6 entries covering:
- Tech stack and key dependencies (category: `stack`)
- Architecture overview — how the pieces fit together (category: `architecture`)
- Development conventions not obvious from code (category: `conventions`)
- Deployment / runtime environment (category: `deployment`)
- Team/project context from answers to your questions (category: `project`)

**`add_decision`** — for each significant architectural decision you can infer from the history:
- Look for: major refactors, technology switches, naming changes, structural reorganizations
- Write one ADR per decision. Set status to `accepted`. Infer consequences from subsequent commits.
- Aim for 3–8 decisions. Skip trivial ones (dependency bumps, formatting).

**`log_tech_debt`** — for each recurring problem you identify:
- Look for: fix commits that repeat, TODOs in commit messages, revert commits, workaround language
- Write one entry per pattern. Set severity based on frequency and impact.
- Aim for 2–5 entries. Only include real patterns, not one-off bugs.

### 4. Pull issue tracker context

Enrich memory with live issue data from all available trackers. Run detection in parallel.

**4.1 — Detect available sources**

- **Beads**: check if `.beads/` directory exists in project root → always include if present
- **GitHub**: run `git remote get-url origin` — if hostname is `github.com`, GitHub may be available
  - Check for token: `$GITHUB_TOKEN` env var, or `.mcp.json` → `mcpServers.github.env.GITHUB_TOKEN`
  - Verify `gh` CLI is available: `gh auth status 2>/dev/null`
- **GitLab**: run `git remote get-url origin` — if hostname matches `gitlab.*`, GitLab may be available
  - Check for token: `$GITLAB_ACCESS_TOKEN` env var, or `.mcp.json` → `mcpServers.gitlab-mcp.env.GITLAB_ACCESS_TOKEN`
  - Try `glab auth status 2>/dev/null` first; fall back to REST API via `curl` with the token

Skip any source where detection or auth fails. Continue with remaining sources — never abort the whole phase.

**4.2 — Fetch issues per detected source**

Fetch in parallel for each available source. Pull **open issues** and **issues closed within the last 90 days** (closed ones are for the summary only).

*Beads:*
```bash
bd list --status=open --json
bd list --status=in_progress --json
bd epic list --json
bd list --status=closed --json   # filter in memory to last 90 days by created_at/updated_at
```

*GitHub:*
```bash
gh issue list --state=open --limit=100 --json number,title,labels,state,body,createdAt
gh issue list --state=closed --limit=200 --json number,title,labels,state,closedAt  # filter to last 90d
```

*GitLab (glab CLI):*
```bash
glab issue list --state=opened --output=json
glab issue list --state=closed --output=json   # filter to last 90d
```

*GitLab (REST API fallback — extract project path from remote URL):*
```bash
GITLAB_HOST=<host>  PROJECT_PATH=<url-encoded-path>
curl -s -H "PRIVATE-TOKEN: $GITLAB_ACCESS_TOKEN" \
  "https://$GITLAB_HOST/api/v4/projects/$PROJECT_PATH/issues?state=opened&per_page=100"
```

**4.3 — Write memory entries**

For each source, write the following. Use `upsert=true` on all calls so re-runs update rather than duplicate.

**Landscape summary** (one per source) — call `add_context` with `upsert=true`:
- `category`: `issues:beads` / `issues:github` / `issues:gitlab`
- `content`: `"As of [date]: [N] open issues ([N] bugs, [N] features, [N] in-progress), [N] closed in last 90 days. Epics: [list titles]. Key themes: [inferred from titles]."`

**Individual entries** (cap at 50 per source):

| Issue type | MCP tool | Key fields | upsert title |
|---|---|---|---|
| Epic / milestone | `update_progress` | milestone=title, status=planned/in-progress/done | epic title |
| Open bug / defect | `log_tech_debt` | description=title, severity=mapped, ticket=id | first line of description |
| Open feature / task | `update_progress` | milestone=title, status=planned/in-progress | issue title |

Priority → severity mapping for `log_tech_debt`:
- P0 / critical → `critical`
- P1 / high → `high`
- P2 / medium → `medium`
- P3, P4, low, none → `low`

Closed issues (last 90d): included in the landscape summary count only, **not** as individual entries.

**4.4 — Report**

After writing all entries, output a single status line:

```
Issue sources: beads ✓ (N issues), github ✓ (N issues), gitlab (skipped — no token)
```

### 5. Confirm

After writing, call `get_memory` for each scope (`context`, `decisions`, `tech_debt`, `progress`) and show the user a summary of what was written. End with:

> Memory bootstrap complete. Future commits will update these files automatically via the git hook.
