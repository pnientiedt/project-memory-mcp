---
description: Generate a Ralph loop command for test-driven feature development
argument-hint: <feature-id-or-description> [max-iterations?]
---

Generate the following `/ralph-loop` command in a code block so I can copy and execute it.

Feature: `$1` (Beads ID if starts with prefix like bd-, otherwise description)
Max iterations: `$2` (default to 40 if not provided)

```
/ralph-loop "TDD Feature Development: $1

## Context
Implementing feature using strict Test-Driven Development:
- RED: Write failing test first
- GREEN: Minimum code to pass
- REFACTOR: Clean up while keeping tests green

## Pre-flight
1. If '$1' is a Beads ID, read: 'bd show $1 --json'
2. If '$1' is a description, create task: 'bd create \"$1\" --type feature --priority 1'
3. Break feature into testable increments if needed

## Workflow (each iteration)
1. Check current state: 'bd show <feature-id> --json'
2. Identify next testable behavior/requirement
3. RED Phase:
   - Write a failing test for the next requirement
   - Run tests, CONFIRM the new test fails
   - If test passes unexpectedly, the behavior already exists - move to next requirement
4. GREEN Phase:
   - Write the MINIMUM code to make the test pass
   - No extra features, no premature optimization
   - Run tests, confirm ALL tests pass
5. REFACTOR Phase:
   - Clean up code while keeping tests green
   - Remove duplication
   - Improve naming
   - Run tests after each refactor step
6. Commit: 'git add . && git commit -m \"feat(<id>): <what behavior was added>\"'
7. Update task notes: 'bd update <id> --notes \"Completed: <requirement>\"'
8. If all requirements complete:
   - Close: 'bd close <id> --reason \"Feature complete with full test coverage\"'
   - Output <promise>FEATURE_TDD_COMPLETE</promise>
9. Otherwise, repeat for next requirement

## TDD Rules (Strict)
- NEVER write implementation code without a failing test first
- NEVER write more than one failing test at a time
- NEVER write more code than needed to pass the current test
- Run tests after EVERY change
- If you break a test, fix it before continuing

## Discovery Protocol
- If you find a bug: 'bd create \"Bug: <issue>\" --type bug --deps discovered-from:<current>'
- If scope creep detected: Note in activity.md but stay focused on current feature
- If blocked by missing dependency: 'bd update <id> --status blocked --notes \"<what's needed>\"'

## Quality Gates
Each commit must have:
- [ ] At least one new test
- [ ] All tests passing
- [ ] No skipped tests
- [ ] Test coverage for the new behavior

## Exit Conditions
- <promise>FEATURE_TDD_COMPLETE</promise> when feature fully implemented with tests
- <promise>BLOCKED</promise> if requirements unclear or external dependency needed
- <promise>STUCK</promise> if cannot figure out how to test a requirement

" --max-iterations ${2:-40} --completion-promise "FEATURE_TDD_COMPLETE"
```

**After generating:** Copy the command above and paste it to start TDD development.
