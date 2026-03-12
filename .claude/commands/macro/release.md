---
description: Execute release workflow with Beads milestone verification
argument-hint: <version> [patch|minor|major]
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, Task, TodoWrite
---

# Release Workflow (Beads-Verified)

Execute release workflow for version: **$ARGUMENTS**

This command verifies Beads milestone completion before release.

## Pre-Release Beads Check

Release blockers (open issues):
!bd list --status open 2>/dev/null | head -10

Open P0/P1 bugs:
!bd list --type bug --status open --priority 0 2>/dev/null
!bd list --type bug --status open --priority 1 2>/dev/null

In-progress work:
!bd list --status in_progress 2>/dev/null

## Release Phases

```
┌─────────────────────────────────────────┐
│  Phase 1: BEADS VERIFICATION            │
│  ├── No open P0/P1 bugs                 │
│  ├── No in_progress blocking tasks      │
│  └── Release milestone complete         │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  Phase 2: QUALITY GATES                 │
│  ├── All tests pass                     │
│  ├── Lint clean                         │
│  └── No uncommitted changes             │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  Phase 3: VERSION & CHANGELOG           │
│  ├── Bump version in manifest           │
│  ├── Generate changelog from Beads      │
│  └── Commit version bump                │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  Phase 4: TAG & SYNC                    │
│  ├── Create git tag                     │
│  ├── Compact closed Beads issues        │
│  └── Sync Beads state                   │
└─────────────────────────────────────────┘
```

## Phase 1: Beads Verification

### Gate Checks

**No Open P0/P1 Bugs:**
```bash
bd list --type bug --status open --priority 0 --json 2>/dev/null | jq length
bd list --type bug --status open --priority 1 --json 2>/dev/null | jq length
```

**No Blocking In-Progress:**
```bash
bd list --status in_progress --json 2>/dev/null | jq length
```

If any check fails: **ABORT with BLOCKED status**

## Phase 2: Quality Gates

```bash
# Tests
npm test || pytest || cargo test || go test ./...

# Lint
npm run lint || ruff check . || cargo clippy || golangci-lint run

# Clean working directory
git status --porcelain
```

If any gate fails: **ABORT with BLOCKED status**

## Phase 3: Version & Changelog

### Generate Changelog from Beads

Use closed issues since last release to build changelog:
```bash
bd list --status closed --json
```

Group by type:
- **Features**: type=feature or type=task
- **Bug Fixes**: type=bug
- **Other**: type=chore

### Update Version Files
Based on detected toolchain (package.json, pyproject.toml, Cargo.toml, etc.)

### Commit
```bash
git add -A
git commit -m "chore: release v$1"
```

## Phase 4: Tag & Sync

### Create Tag
```bash
git tag -a v$1 -m "Release v$1"
```

### Compact Old Issues
```bash
bd compact --before 30d
```

### Sync Beads
```bash
bd sync
```

## Exit Conditions

### COMPLETE
```
## RELEASE COMPLETE

### Version
v$1

### Beads Verification
- P0 bugs: 0
- P1 bugs: 0
- In-progress: 0

### Quality Gates
- Tests: PASS
- Lint: PASS

### Changes
- Version bumped
- CHANGELOG updated from Beads
- Git tag created: v$1
- Beads synced and compacted

### Next Steps
1. Review: `git log -1 && git show v$1`
2. Push: `git push && git push --tags`
3. Publish (if applicable)
```

### BLOCKED
```
## RELEASE BLOCKED

### Blocking Issues

**Open P0/P1 Bugs:**
!bd list --type bug --status open --priority 0
!bd list --type bug --status open --priority 1

**In-Progress Work:**
!bd list --status in_progress

### Required Actions
1. Fix blocking bugs: `/fix-bugs`
2. Complete in-progress work
3. Retry release

### No Changes Made
Release aborted before any modifications.
```

## Constraints

- Never release with open P0/P1 bugs
- Never force-push
- Always generate changelog from Beads
- Always sync Beads after release

## Begin

Start by verifying Beads state - check for open P0/P1 bugs and in-progress work.
