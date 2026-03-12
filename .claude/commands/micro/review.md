---
description: Review code changes for quality and issues
allowed-tools: Read, Grep, Glob, Bash(git diff:*)
argument-hint: [file or directory to review]
---

## Current Changes
!`git diff --stat HEAD`

## Task

Review the code changes for Go best practices:

1. **Correctness** - Logic errors, edge cases, nil pointer handling
2. **Go idioms** - Error handling, goroutine safety, interface usage
3. **Security** - Input validation, command injection, path traversal
4. **Performance** - Unnecessary allocations, efficient I/O
5. **Maintainability** - Code clarity, naming, package structure
6. **Testing** - Missing tests, edge case coverage

For each issue found:
- Severity: Critical / High / Medium / Low
- Location: File and line number
- Description: What the issue is
- Suggestion: How to fix it (with code example)

If $ARGUMENTS provided, focus review on that file/directory.

End with a summary: total issues by severity, overall assessment.
