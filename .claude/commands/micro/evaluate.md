---
description: Investigate GitLab issues and create implementation tasks
allowed-tools: Bash(bd:*), Bash(git:*), Bash(curl:*), Read, Glob, Grep, Task
argument-hint: [eval-task-id]
---

## Current Evaluation Tasks
!`bd list --status=open --type=task 2>/dev/null | grep -i "evaluate:" || echo "No evaluation tasks found"`

## Task

Investigate a GitLab-sourced issue and create implementation tasks:

### 1. Select Evaluation Task
- If $1 provided, use that task ID
- Otherwise, find the highest priority open task with "Evaluate:" prefix
- Claim it: `bd update <id> --status in_progress`

### 2. Gather Context
- Show the evaluation task: `bd show <id>`
- Extract the GitLab issue URL from the description
- Identify the parent Epic this evaluation task blocks

### 3. Investigate the Codebase
**Goal:** Understand what the GitLab issue means for this codebase

- Read the issue requirements carefully
- Search for related code using Glob and Grep
- Read relevant files to understand current implementation
- Identify:
  - What functionality is missing or broken
  - Which files/modules need changes
  - Any dependencies or architectural considerations
  - Potential risks or edge cases

### 4. Document Findings
Update the evaluation task with your findings:

```bash
bd update <eval-id> --description "$(cat <<'EOF'
## Evaluation Task
[original content]

### Findings

#### Problem Analysis
- [What the issue is asking for]
- [Current state of the codebase]
- [Gap between current and desired state]

#### Affected Components
- [List of files/modules that need changes]

#### Implementation Approach
- [High-level approach to solve the issue]
- [Key decisions and tradeoffs]

#### Risks & Considerations
- [Edge cases, backward compatibility, etc.]
EOF
)"
```

### 5. Create Implementation Tasks
Create sub-tasks under the Epic for each piece of work:

```bash
# Get the parent Epic ID (the evaluation task blocks it)
bd show <eval-id>  # Look at "Blocks" section

# Create implementation tasks
bd create --title "Implement X" --type task --parent <epic-id> --description "..."
bd create --title "Add tests for X" --type task --parent <epic-id> --description "..."
bd create --title "Update docs for X" --type task --parent <epic-id> --description "..."
```

Guidelines for task creation:
- Break work into small, testable chunks
- Each task should be completable in one session
- Include acceptance criteria in descriptions
- Add dependencies between tasks if needed

### 6. Complete Evaluation
- Close the evaluation task: `bd close <eval-id> --reason "Investigation complete. Created N implementation tasks."`
- This unblocks the parent Epic
- The Epic can now be worked on (or its sub-tasks)

### 7. Summary
Report:
- What you found during investigation
- Implementation tasks created
- Recommended order of work
- Any questions or clarifications needed from GitLab issue author

---

**Important:**
- Findings stay LOCAL in Beads (not synced back to GitLab)
- Only status changes and comments sync to GitLab
- Use `bd-gitlab sync` if you want to manually trigger a sync
