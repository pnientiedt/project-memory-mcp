---
description: Autonomously implement features from Beads epic/task hierarchy
argument-hint: <epic-id or task-id> [--max-iterations <N>]
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, Task, TodoWrite
---

# Implement Feature (Beads-Driven)

Autonomously implement tasks from Beads epic: **$1**

## Execution Modes

**Interactive (monitor progress in this session):**
```
/ralph/epic $1
```

**Headless (run overnight, fresh context each iteration):**
```bash
./.claude/scripts/ralph/epic.sh $1 -n 50
```

**Direct (execute in this session):**
Continue below...

---

## Current Beads State

Epic/Task details:
!bd show $1 2>/dev/null || echo "Task not found - run: bd list"

Ready tasks under this epic:
!bd ready --json 2>/dev/null | head -20

In-progress tasks:
!bd list --status in_progress 2>/dev/null

## Execution Model

You operate in iterations, with Beads as the source of truth for work items.

### Each Iteration

```
ITERATION {n}
├── QUERY: bd ready --json (find unblocked tasks)
├── SELECT: Highest priority task under $1
├── CLAIM: bd update <id> --status in_progress
├── IMPLEMENT: Code + tests
├── VERIFY: Quality gates pass
├── CLOSE: bd close <id> --reason "<summary>"
└── REPEAT or EXIT
```

### Beads Workflow Integration

**Task Discovery:**
```bash
bd ready --json | jq '.[] | select(.parent == "$1" or .id == "$1")'
```

**Task Claiming:**
```bash
bd update <task-id> --status in_progress
```

**Progress Notes:**
```bash
bd update <task-id> --notes "Implementing: <current work>"
```

**Task Completion:**
```bash
bd close <task-id> --reason "<what was accomplished>"
```

**Bug Discovery (during implementation):**
```bash
bd create "<bug title>" --type bug --priority 1 --parent $1
```

**Subtask Discovery:**
```bash
bd create "<subtask>" --type task --parent <current-task>
```

### Priority Order

1. P0 (Critical) tasks
2. P1 (High) tasks
3. P2 (Medium) tasks
4. P3 (Low) tasks
5. Tasks blocking other work

### Quality Gates (Per Task)

Before closing any task:
- [ ] Code compiles/runs without errors
- [ ] Tests pass (new + existing)
- [ ] Lint clean
- [ ] Changes match task description

## Exit Conditions

### COMPLETE
When: `bd ready` returns no tasks under epic $1
```
## COMPLETE

<promise>EPIC_COMPLETE</promise>

### Epic: $1
All tasks under this epic are closed.

### Summary
- Tasks completed: [count]
- Files modified: [count]
- Tests added: [count]

### Verification
!bd list --parent $1 --status open
(Should be empty)

### Final Sync
!bd sync
```

### BLOCKED
When: Task requires human decision or external dependency
```
## BLOCKED

<promise>BLOCKED</promise>

### Blocking Task
!bd show <task-id>

### Issue
[What's blocking progress]

### Action Taken
!bd update <task-id> --status blocked --notes "<blocker description>"

### Required to Unblock
[Specific decision or resource needed]
```

### STUCK
When: No progress after 3 iterations on same task
```
## STUCK

<promise>STUCK</promise>

### Task That Won't Complete
!bd show <task-id>

### Attempts
- Iteration N: [approach] → [result]
- Iteration N+1: [approach] → [result]
- Iteration N+2: [approach] → [result]

### Action Taken
!bd update <task-id> --status blocked --notes "Stuck: <reason>"

### Alternatives Not Tried
[Other approaches]
```

## Stuck Detection

Increment stuck counter when:
- Same task claimed for 3+ consecutive iterations
- Same error occurs twice
- Tests fail with identical error

Reset stuck counter when:
- New task selected from `bd ready`
- Different error encountered
- Tests change status

**Stuck threshold: 3** → Exit with STUCK, mark task as blocked

## Discovery Protocol

If you discover work during implementation:

**Found a bug:**
```bash
bd create "Bug: <description>" --type bug --priority 1 --parent $1
```

**Found a needed subtask:**
```bash
bd create "<subtask>" --type task --parent <current-task-id>
```

**Found a blocker:**
```bash
bd update <current-task-id> --status blocked --notes "Blocked by: <issue>"
```

Do NOT work on discovered items immediately - let `bd ready` handle sequencing.

## Commit Discipline

After completing each task:
```bash
git add -A
git commit -m "<type>(<task-id>): <description>"
```

Types: feat, fix, refactor, test, docs, chore

## Begin

Start iteration 1:
1. Run `bd ready --json` to find unblocked tasks
2. Select highest priority task under $1
3. Claim with `bd update <id> --status in_progress`
4. Implement the task
