---
description: Complete current work, run quality gates, and close task
allowed-tools: Bash(bd:*), Bash(git:*), Bash(go:*), Bash(golangci-lint:*)
argument-hint: [issue-id] [completion reason]
---

## Current State
- Git status: !`git status --short`
- In progress tasks: !`bd list --status=in_progress 2>/dev/null || echo "beads not initialized"`
- Branch: !`git branch --show-current`

## Task

Complete the current work:

1. **Run quality gates**
   - `go test ./...` - all tests must pass
   - `go vet ./...` - no issues
   - `golangci-lint run` - lint checks pass
   - Fix any failures before proceeding

2. **Commit changes**
   - Stage all relevant changes
   - Use conventional commit format linked to issue: `feat(<id>): description`
   - Types: feat, fix, refactor, docs, test, chore, perf

3. **Close the task**
   - If $1 provided, use as issue ID
   - Otherwise use the in_progress task
   - Close with reason: `bd close <id> --reason "<summary>"`

4. **Sync**
   - Run `bd sync` to save beads state
   - If on feature branch, push commits

5. **Report**
   - Summary of what was completed
   - Any follow-up work discovered (file as new issues)
