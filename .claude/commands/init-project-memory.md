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

### 4. Confirm

After writing, call `get_memory` for each scope (`context`, `decisions`, `tech_debt`) and show the user a summary of what was written. End with:

> Memory bootstrap complete. Future commits will update these files automatically via the git hook.
