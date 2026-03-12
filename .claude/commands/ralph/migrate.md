---
description: Generate a Ralph loop command for codebase migration/refactoring
argument-hint: "<description>" [file-pattern?] [max-iterations?]
---

Generate the following `/ralph-loop` command in a code block so I can copy and execute it.

Migration description: `$1`
File pattern (optional): `$2` (e.g., "src/**/*.ts", defaults to scanning whole codebase)
Max iterations: `$3` (default to 60 if not provided)

```
/ralph-loop "Codebase Migration: $1

## Context
Systematic migration/refactoring of codebase: $1
${2:+Targeting files matching: $2}

## Pre-flight Setup
1. If no migration tasks exist in Beads:
   a. Scan ${2:-the codebase} for files requiring migration
   b. Create a parent epic: 'bd create \"Migration: $1\" --type epic --priority 1'
   c. For each file needing migration:
      'bd create \"Migrate <filename>\" --type task --parent <epic-id> --priority 2'
2. Run 'bd ready --json' to see what's ready to migrate

## Workflow (each iteration)
1. Query: 'bd ready --json' -> find next file to migrate
2. Select highest priority ready migration task
3. Claim: 'bd update <id> --status in_progress'
4. Migrate the file:
   - Apply the migration pattern consistently
   - Update any imports/references in other files
   - Preserve existing functionality exactly
5. Verify:
   - Run 'go build ./...' (if Go)
   - Run tests related to this file
   - Run full test suite
6. Commit: 'git add . && git commit -m \"refactor(<id>): migrate <filename> - $1\"'
7. Close: 'bd close <id> --reason \"Migrated <old pattern> to <new pattern>\"'
8. Update activity.md
9. Repeat

## Discovery Protocol
If migration reveals issues:
- Breaking API changes: 'bd create \"API: <issue>\" --type bug --priority 1 --deps blocks:<current>'
- Additional files needing migration: 'bd create \"Migrate <file>\" --type task --parent <epic-id>'
- If current task blocked, update status and move to next: 'bd update <id> --status blocked --notes \"<reason>\"'

## Constraints
- Migrate ONE file per iteration (atomic changes)
- ${2:+Only modify files matching: $2}
- Do not change functionality, only structure/patterns
- All tests must pass before closing a task
- If tests fail, fix or revert before moving on

## Quality Gates
Before closing any task, verify:
- [ ] Code compiles
- [ ] All tests pass
- [ ] No new linter errors
- [ ] File follows new pattern consistently

## Exit Conditions
- <promise>MIGRATION_COMPLETE</promise> when all migration tasks closed and tests pass
- <promise>BREAKING_CHANGES</promise> if migration requires API changes needing review
- <promise>BLOCKED</promise> if pattern unclear or need human decision
- <promise>STUCK</promise> after 5 iterations without closing a task

" --max-iterations ${3:-60} --completion-promise "MIGRATION_COMPLETE"
```

**After generating:** Copy the command above and paste it to start the migration.

**Tip:** For large migrations, consider running with `--max-iterations 20` first to validate the pattern, then increase.
