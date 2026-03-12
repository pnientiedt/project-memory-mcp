---
description: Create a well-formatted pull request
argument-hint: [--title <title>] [--draft]
allowed-tools: Read, Grep, Glob, Bash
---

# Create Pull Request

Create a pull request for the current branch.

This command follows the GEV pattern for PR creation.

## Gate Phase

### Prerequisites

1. **On Feature Branch**: Not on main/master
!git branch --show-current

2. **Commits Exist**: Something to PR
!git log origin/main..HEAD --oneline 2>/dev/null | head -5 || git log origin/master..HEAD --oneline 2>/dev/null | head -5

3. **Tests Pass**: Quality gate
!npm test 2>&1 | tail -3 || pytest 2>&1 | tail -3 || echo "Tests not run"

4. **Pushed to Remote**: Branch must be pushed
!git status | grep -E "ahead|behind" || echo "In sync or not tracked"

### Gate Output
```
| Gate | Status |
|------|--------|
| Feature branch | PASS/FAIL |
| Has commits | PASS/FAIL |
| Tests pass | PASS/WARN |
| Pushed | PASS/FAIL |
```

## Execute Phase

### Gather PR Information

**Commits to Include:**
!git log origin/main..HEAD --oneline 2>/dev/null || git log origin/master..HEAD --oneline 2>/dev/null

**Files Changed:**
!git diff origin/main --stat 2>/dev/null || git diff origin/master --stat 2>/dev/null

### Generate PR Content

**Title**: From `$ARGUMENTS --title` or generate from commits:
- feat: → "Add [feature]"
- fix: → "Fix [issue]"
- refactor: → "Refactor [area]"

**Description** (auto-generated):
```markdown
## Summary
[Generated from commit messages]

## Changes
[List of significant changes]

## Testing
- [ ] Tests pass locally
- [ ] Manual testing completed

## Checklist
- [ ] Code follows project conventions
- [ ] Documentation updated (if needed)
- [ ] No breaking changes (or documented)
```

### Create PR

Using GitHub CLI (if available):
```bash
gh pr create --title "<title>" --body "<body>"
```

Or provide manual instructions if gh not available.

## Verify Phase

### PR Created Successfully

```
## Pull Request Created

### Details
- **Title:** [PR title]
- **URL:** [PR URL]
- **Base:** main ← [branch]
- **Commits:** [count]
- **Files Changed:** [count]

### Summary
[Generated description]

### Next Steps
1. Request reviewers
2. Address feedback
3. Merge when approved
```

### If PR Creation Fails

```
## PR Creation Failed

### Issue
[Error message]

### Alternatives
1. Create manually at: [repo URL]/compare
2. Fix issue and retry
```

## Arguments

- `--title "PR Title"`: Override auto-generated title
- `--draft`: Create as draft PR
- `--reviewer @user`: Add reviewer

## Begin

Start by verifying gate conditions (feature branch, commits exist).
