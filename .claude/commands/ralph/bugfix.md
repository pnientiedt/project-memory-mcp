---
description: Generate a Ralph loop command for a bug fix sprint
argument-hint: [epic-id?] [max-iterations?]
---

Generate the following `/ralph-loop` command in a code block so I can copy and execute it.

Epic ID filter (optional): `$1` (if empty, work on all open bugs)
Max iterations: `$2` (default to 30 if not provided)

```
/ralph-loop "Bug Fix Sprint${1:+ for epic $1}:

## Context
Systematically fix bugs in priority order, ensuring each fix includes a regression test.

## Pre-flight
- Run 'bd list --type bug --status open --json' to see bug landscape
- Check activity.md for any bugs recently attempted but not fixed

## Workflow (each iteration)
1. Query bugs: 'bd list --type bug --status open${1:+ --parent $1} --json | jq \"sort_by(.priority)\"'
2. Select highest priority (lowest number) bug
3. Claim: 'bd update <id> --status in_progress'
4. Investigate:
   - Read the bug description and any linked issues
   - Reproduce the bug locally if possible
   - Identify root cause
5. Fix:
   - Implement the minimum change to fix the bug
   - Add a regression test that would have caught this bug
6. Verify:
   - Run the new regression test
   - Run full test suite to check for side effects
   - Manually verify fix if applicable
7. Commit: 'git add . && git commit -m \"fix(<id>): <root cause and fix summary>\"'
8. Close: 'bd close <id> --reason \"Root cause: <X>. Fixed by: <Y>. Regression test added.\"'
9. Update activity.md
10. Repeat

## Discovery Protocol
If you find additional bugs while fixing:
- File: 'bd create \"<title>\" --type bug --priority <severity> --deps discovered-from:<current>'
- Note in activity.md for visibility
- Continue with current bug

## Bug Severity Guide
- Priority 0: Crashes, data loss, security issues
- Priority 1: Major feature broken
- Priority 2: Minor feature issues
- Priority 3: Cosmetic, edge cases

## Constraints
- One bug per iteration (no bundling fixes)
- Every fix MUST have a regression test
- Do not refactor unrelated code while fixing

## Exit Conditions
- <promise>BUGS_CLEARED</promise> when no open bugs remain${1:+ under $1}
- <promise>COMPLEX_BUG</promise> if bug requires architectural changes beyond scope
- <promise>BLOCKED</promise> if cannot reproduce or need more information
- <promise>STUCK</promise> after 3 iterations on the same bug

" --max-iterations ${2:-30} --completion-promise "BUGS_CLEARED"
```

**After generating:** Copy the command above and paste it to start the bug fix sprint.
