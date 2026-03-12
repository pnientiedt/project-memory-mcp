---
description: Autonomously fix bugs from Beads in priority order
argument-hint: [--scope <epic-id>] [--max <count>]
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, Task, TodoWrite
---

# Fix Bugs (Beads-Driven)

Autonomously fix bugs tracked in Beads.

## Execution Modes

**Interactive (monitor progress in this session):**
```
/ralph/bugfix $ARGUMENTS
```

**Headless (run overnight, fresh context each iteration):**
```bash
./.claude/scripts/ralph/bugfix.sh $ARGUMENTS
```

**Direct (execute in this session):**
Continue below...

---

## Current Beads State

Open bugs:
!bd list --type bug --status open 2>/dev/null || echo "No bugs or beads not initialized"

Ready bugs (unblocked):
!bd ready --json 2>/dev/null | jq '.[] | select(.type == "bug")' | head -20

In-progress bugs:
!bd list --type bug --status in_progress 2>/dev/null

## Execution Model

### Each Iteration

```
ITERATION {n}
├── QUERY: bd ready --json | filter type=bug
├── SELECT: Highest priority bug (P0 > P1 > P2 > P3)
├── CLAIM: bd update <id> --status in_progress
├── INVESTIGATE: Root cause analysis
├── FIX: Targeted code change
├── VERIFY: Tests pass + regression test added
├── CLOSE: bd close <id> --reason "<root cause and fix>"
└── REPEAT or EXIT
```

### Bug Priority Order

1. P0 - Critical (system down, data loss)
2. P1 - High (major feature broken)
3. P2 - Medium (feature degraded)
4. P3 - Low (minor issues)

### Per-Bug Workflow

**1. Claim the bug:**
```bash
bd update <bug-id> --status in_progress
```

**2. Investigate:**
- Read bug description: `bd show <bug-id>`
- Find related code
- Identify root cause

**3. Document findings:**
```bash
bd update <bug-id> --notes "Root cause: <analysis>"
```

**4. Fix:**
- Make minimal targeted change
- Don't refactor unrelated code
- Add regression test

**5. Verify:**
- Run tests
- Confirm bug is fixed
- Check for regressions

**6. Close with details:**
```bash
bd close <bug-id> --reason "Root cause: X. Fix: Y. Regression test added."
```

**7. Commit:**
```bash
git commit -m "fix(<bug-id>): <description>"
```

## Exit Conditions

### COMPLETE
When: No bugs returned by `bd ready --type bug`
```
## COMPLETE

<promise>BUGS_CLEARED</promise>

### Summary
- Bugs fixed: [count]
- Regression tests added: [count]

### Remaining Bugs (blocked)
!bd list --type bug --status blocked

### Final Sync
!bd sync
```

### BLOCKED
When: Bug requires human decision or external resource
```
## BLOCKED

<promise>BLOCKED</promise>

### Bug
!bd show <bug-id>

### Analysis
[Root cause investigation]

### Why Blocked
[Decision needed or resource required]

### Action Taken
!bd update <bug-id> --status blocked --notes "<blocker>"
```

### STUCK
When: Same bug fails to fix after 3 attempts
```
## STUCK

<promise>STUCK</promise>

### Bug
!bd show <bug-id>

### Attempts
- Attempt 1: [fix tried] → [why it failed]
- Attempt 2: [fix tried] → [why it failed]
- Attempt 3: [fix tried] → [why it failed]

### Action Taken
!bd update <bug-id> --status blocked --notes "Stuck after 3 attempts: <summary>"
```

## Discovery During Fixes

**Found related bug:**
```bash
bd create "Bug: <description>" --type bug --priority <P> --related <current-bug-id>
```

**Fix introduces new issue:**
Revert the change, create new bug, move to next bug.

**Bug is duplicate:**
```bash
bd close <bug-id> --reason "Duplicate of <other-id>"
```

## Constraints

- Fix ONE bug per iteration
- Always add regression test
- Don't "improve" surrounding code
- If fix breaks other tests, revert and rethink

## Begin

Start iteration 1:
1. Run `bd ready --json` and filter for type=bug
2. Select highest priority unblocked bug
3. Claim with `bd update <id> --status in_progress`
4. Investigate and fix
