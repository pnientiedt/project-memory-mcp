---
description: Generate a Ralph loop command to execute a Beads epic
argument-hint: <epic-id> [max-iterations?]
---

Generate the following `/ralph-loop` command in a code block so I can copy and execute it.

Use epic ID: `$1`
Max iterations: `$2` (default to 50 if not provided)

```
/ralph-loop "Execute Beads epic $1:

## Context
Working through all tasks under epic $1 using Beads dependency-aware workflow.

## Pre-flight
- Read activity.md if it exists for recent context
- Run 'bd show $1 --json' to understand epic scope

## Workflow (each iteration)
1. Run 'bd ready --json' to find unblocked tasks
2. Filter to tasks with parent $1 or linked to epic
3. Select highest priority ready task
4. Claim: 'bd update <id> --status in_progress'
5. Implement fully:
   - Write code following project conventions
   - Add/update tests as needed
   - Run linter and fix issues
6. Verify: run test suite
7. Commit: 'git add . && git commit -m \"feat(<id>): <description>\"'
8. Close: 'bd close <id> --reason \"<summary of what was accomplished>\"'
9. Update activity.md with progress entry
10. Repeat

## Discovery Protocol
If you find new work during implementation:
- File immediately: 'bd create \"<title>\" --type <bug|task> --parent $1 --deps discovered-from:<current-task>'
- Do NOT work on it now; continue with current task

## Constraints
- Only work on tasks linked to epic $1
- Do not modify files outside the epic's scope
- Run tests before every commit
- Never skip the verification step

## Exit Conditions
- <promise>EPIC_COMPLETE</promise> when 'bd list --parent $1 --status open' returns empty
- <promise>BLOCKED</promise> if human decision required (architectural, access, unclear requirements)
- <promise>STUCK</promise> after 5 consecutive iterations without closing a task

" --max-iterations ${2:-50} --completion-promise "EPIC_COMPLETE"
```

**After generating:** Copy the command above and paste it to start the autonomous loop.
