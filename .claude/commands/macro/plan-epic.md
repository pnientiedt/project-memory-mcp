---
description: Create a fully-specified Beads epic from a specification document
argument-hint: <spec-file-path> [--epic-prefix <PREFIX>]
allowed-tools: Read, Glob, Grep, Bash, Task, TodoWrite, WebSearch
---

# Plan Epic from Specification

Create a complete, well-documented Beads epic from specification: **$1**

This command implements the **Ralph Wiggum pattern** for autonomous epic planning with explicit stop conditions.

---

## CRITICAL: STOP CONDITIONS

This command will **STOP** (exit the loop) when ANY of these conditions are met:

| Exit | Trigger | Promise Tag |
|------|---------|-------------|
| **COMPLETE** | All phases finished, epic verified | `<promise>PLANNING_COMPLETE</promise>` |
| **MUST ASK** | Phase 1 gate fails - specification ambiguity | `<promise>BLOCKED:MUST_ASK</promise>` |
| **RUNTIME BLOCKED** | Cannot proceed due to external factor | `<promise>BLOCKED:RUNTIME</promise>` |
| **STUCK** | Same error 3+ times consecutively | `<promise>STUCK</promise>` |

**When you output a `<promise>` tag:**
- This is your FINAL output for the command
- Do NOT continue processing after outputting a promise
- Do NOT attempt workarounds when MUST ASK conditions are met

---

## Progress Tracking

Use TodoWrite to track iteration progress. Each action = one iteration.

```
PHASE 1: Understand specification
├── Load spec file
├── Extract PRIMARY_GOAL
├── Extract VALUE_PROPOSITION
├── Extract SCOPE_IN
├── Extract SCOPE_OUT
├── Extract ACCEPTANCE_CRITERIA
├── Extract TECHNICAL_CONSTRAINTS
└── MUST ASK Gate [STOP POINT]

PHASE 2: Research codebase
├── Query: Similar implementations
├── Query: File organization
├── Query: Test patterns
├── Query: Configuration patterns
├── Query: Error handling patterns
└── Query: Impact surface

PHASE 3: Decompose into tasks
├── Identify components
├── Size tasks (1-4 hours each)
└── Map dependencies

PHASE 4: Create epic and tasks
├── Create epic
├── Create implementation tasks
├── Create test tasks
├── Create QA tasks
└── Set dependencies

PHASE 5: Verify completeness
├── Verify epic
├── Verify all tasks
└── Verify dependencies
```

---

## Phase 1: Understand the Specification [HARD GATE]

**This phase MUST complete before any other work. If this phase outputs BLOCKED, the entire command terminates.**

### 1.1 Load the Specification

Read the specification file completely:
@$1

### 1.2 Extract Core Information [REQUIRED]

You MUST extract and document ALL of these. Track each as an iteration.

**MANDATORY EXTRACTIONS:**

| Field | Extraction | Status |
|-------|------------|--------|
| **PRIMARY_GOAL** | One sentence: what does success look like? | [ ] |
| **VALUE_PROPOSITION** | Why does this matter to users/business? | [ ] |
| **SCOPE_IN** | Explicit list of what will be delivered | [ ] |
| **SCOPE_OUT** | What is explicitly NOT included | [ ] |
| **ACCEPTANCE_CRITERIA** | Testable conditions for "done" | [ ] |
| **TECHNICAL_CONSTRAINTS** | Performance, security, compatibility requirements | [ ] |

**FUNCTIONAL REQUIREMENTS:**
Extract each distinct feature/behavior the spec requires:
1. [Requirement 1]
2. [Requirement 2]
... (continue for all)

**NON-FUNCTIONAL REQUIREMENTS:**
- Performance: [extract or "not specified"]
- Security: [extract or "not specified"]
- Scalability: [extract or "not specified"]

### 1.3 MUST ASK Gate [STOP POINT]

**This is a STOP POINT. You must evaluate each condition and make a GO/NO-GO decision.**

#### MUST ASK Checklist

Evaluate EACH condition. For each, provide:
- **Answer**: YES or NO (no maybe)
- **Evidence**: Direct quote from spec, or "not specified", or "N/A"

| # | Condition | Evaluation Question | Answer | Evidence |
|---|-----------|---------------------|--------|----------|
| **MA-1** | **Contradictory Goal** | Does the spec contain multiple interpretations of success that are mutually exclusive? (e.g., "maximize speed" AND "minimize resource usage" without priority) | ___ | ___ |
| **MA-2** | **Missing API Contract** | Are there external API calls where endpoint, authentication method, or request/response format is undefined? | ___ | ___ |
| **MA-3** | **Undefined Security** | Are security requirements mentioned without specifics? (e.g., "must be secure" without auth method, encryption standard, or compliance framework) | ___ | ___ |
| **MA-4** | **Unspecified Dependencies** | Are external systems mentioned without integration details? (e.g., "connects to payment system" without API docs or contract) | ___ | ___ |

#### MUST ASK Decision

**If ANY of MA-1 through MA-4 is YES:**

You MUST output the following and **STOP IMMEDIATELY**:

```markdown
## BLOCKED

<promise>BLOCKED:MUST_ASK</promise>

### Specification Requires Clarification

Planning cannot proceed without answers to the following questions.

### Questions Requiring Answers

| # | Topic | Spec Quote | Specific Question | Impact if Wrong |
|---|-------|------------|-------------------|-----------------|
| 1 | [topic] | "[quote]" or "not specified" | [what needs clarification] | [what breaks] |

### What Was Successfully Extracted

[List all fields from 1.2 that were successfully extracted]

### Suggested Defaults

If you want to proceed with assumptions instead of waiting for answers:

| # | Question | Suggested Default | Rationale | Risk Level |
|---|----------|-------------------|-----------|------------|
| 1 | [question] | [default] | [why reasonable] | Low/Medium/High |

### To Unblock

**Option A:** Answer the questions above, then re-run: `/plan-epic $1`
**Option B:** Reply "proceed with defaults" to use suggested defaults
```

**DO NOT proceed to Phase 2 when MUST ASK fires.**

---

**If ALL of MA-1 through MA-4 are NO:**

Document the completed table, then proceed to Phase 2:

```markdown
#### MUST ASK Gate: PASSED

| # | Condition | Answer | Evidence |
|---|-----------|--------|----------|
| MA-1 | Contradictory Goal | NO | [evidence] |
| MA-2 | Missing API Contract | NO | [evidence] |
| MA-3 | Undefined Security | NO | [evidence] |
| MA-4 | Unspecified Dependencies | NO | [evidence] |

**Proceeding to Phase 2: Research Codebase**
```

### 1.4 Assumptions (if MUST ASK passed)

For items that are unclear but CAN proceed with assumption:

**CAN PROCEED WITH ASSUMPTION:**
- Minor implementation details (exact error messages)
- Naming conventions (when codebase has patterns)
- Test coverage levels (when codebase has standards)

**Document all assumptions:**

| Topic | Spec Said | Assumption Made | Risk if Wrong |
|-------|-----------|-----------------|---------------|
| [topic] | [quote or "not specified"] | [your assumption] | [impact] |

---

## Phase 2: Research Codebase [GATE]

### 2.1 Mandatory Research Queries

Execute ALL of the following. Each query = one iteration. Document findings for each.

**Query 2.1.1: Similar Implementations**

Find existing code similar to what you're building:
```
Search for: [key domain terms from spec]
Example: For "authentication", search: auth, login, session, token, user
```

Document:
- File paths found
- Patterns used
- Conventions to follow

**Query 2.1.2: File Organization**

Understand where code should live:
```
Examine directory structure
Find where similar features are located
Identify naming conventions for files/folders
```

Document:
- Directory structure pattern
- Where new code should go
- File naming conventions

**Query 2.1.3: Test Patterns**

Find how this codebase writes tests:
```
Find test files: **/*.test.{ts,js} OR **/*.spec.{ts,js} OR **/test_*.py
Read 2-3 representative test files
```

Document:
- Test framework in use
- Assertion style
- Mocking patterns
- Test file location conventions

**Query 2.1.4: Configuration Patterns**

Identify configuration approach:
```
Search for: config, env, settings, constants
```

Document:
- Where configuration lives
- Environment variable patterns
- How to add new config values

**Query 2.1.5: Error Handling Patterns**

Find how errors are handled:
```
Search for: Error, Exception, try, catch, throw
```

Document:
- Error class patterns
- Logging patterns
- Error response format

**Query 2.1.6: Impact Surface**

For each component you'll build, identify:
- Files that will be modified
- Files that import/depend on those files
- Tests that may need updates

### 2.2 Research Summary Table

Before proceeding, complete this table:

| Area | Files Examined | Pattern Found | Apply To Tasks |
|------|----------------|---------------|----------------|
| Similar implementations | [list 3+] | [description] | [how to use] |
| File organization | [structure] | [convention] | [where to put code] |
| Test patterns | [list 2+] | [framework/style] | [testing approach] |
| Configuration | [files] | [pattern] | [new config needed] |
| Error handling | [files] | [pattern] | [error approach] |
| Impact surface | [files] | [dependencies] | [what to test] |

**Phase 2 Exit Criteria:**
- [ ] At least 5 existing files have been read
- [ ] Test file examples examined
- [ ] Directory structure documented
- [ ] Code conventions documented
- [ ] Impact surface identified

**If any checkbox is unchecked → Continue research (do not proceed)**

---

## Phase 3: Decompose into Tasks

### 3.1 Component Breakdown

Break the spec into logical components:

```
[Feature Name]
├── Component A: [e.g., API Layer]
│   ├── Task A1: [specific deliverable]
│   ├── Task A2: [specific deliverable]
│   └── Test-A: Tests for Component A
├── Component B: [e.g., Data Layer]
│   ├── Task B1: [specific deliverable]
│   └── Test-B: Tests for Component B
├── Component C: [e.g., UI Layer]
│   ├── Task C1: [specific deliverable]
│   └── Test-C: Tests for Component C
└── QA Validation
    ├── QA-Integration: Full integration testing
    └── QA-Acceptance: Acceptance criteria verification
```

### 3.2 Task Sizing

Each task should be:
- Completable in 1-4 hours
- Independently testable
- Has single clear outcome

**If a task is too large:** Split into smaller tasks
**If tasks are too granular:** Combine related work

### 3.3 Task Categories

**Implementation Tasks** (type: feature)
- Produce working code
- Have measurable output
- Priority 1-2

**Test Tasks** (type: task)
- Create test coverage
- Depend on implementation tasks
- Priority 2

**QA Tasks** (type: task)
- Validate complete feature
- Depend on all tests passing
- Priority 3

### 3.4 Dependency Mapping

Map which tasks depend on which:

```
[Task A1] ──┬──▶ [Task A2] ──▶ [Test-A] ──┐
            │                              │
[Task B1] ──┴──▶ [Test-B] ────────────────┼──▶ [QA-Integration]
                                          │
[Task C1] ──────▶ [Test-C] ───────────────┘
```

Rules:
- No circular dependencies
- Tests depend on their implementation
- QA depends on all tests
- Identify parallel tracks

---

## Phase 4: Create Epic and Tasks

### 4.1 Create the Epic

```bash
bd create "[Epic Title]" --type epic --priority 1
```

Note the returned epic ID (e.g., `bd-abc123`).

Then add comprehensive documentation:

```bash
bd update <EPIC-ID> --notes "$(cat <<'EOF'
## Overview
[2-3 sentences: what this epic delivers and why it matters]

## Background & Context
[Problem being solved, current vs desired state]

## Scope

### In Scope
- [Deliverable 1]
- [Deliverable 2]

### Out of Scope
- [Explicitly excluded 1]
- [Explicitly excluded 2]

### Assumptions
| Topic | Assumption | Risk if Wrong |
|-------|------------|---------------|
| [topic] | [assumption] | [impact] |

## Technical Approach
[High-level strategy based on codebase research]

### Architecture Changes
[Components affected, new components]

### Patterns to Follow
Based on codebase research:
- [Pattern 1 from file X]
- [Pattern 2 from file Y]

## Success Criteria
- [ ] [Measurable criterion 1]
- [ ] [Measurable criterion 2]
- [ ] All tests pass with >80% coverage
- [ ] QA validation complete

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| [Risk 1] | [Impact] | [Mitigation] |

## Task Summary
- Implementation tasks: [N]
- Test tasks: [N]
- QA tasks: [N]
- Critical path: [Task A] → [Task B] → [QA]

## Open Questions
- [Question needing stakeholder input]

## References
- Source specification: $1
EOF
)"
```

### 4.2 Create Implementation Tasks

For EACH implementation task, create with this template:

```bash
bd create "[Task Title]" --type feature --priority <1-2>
```

Then add full specification:

```bash
bd update <TASK-ID> --notes "$(cat <<'EOF'
## Summary
[1-2 sentences: what this task delivers]

## Context
[Why this task exists, how it fits into the epic]

## Requirements

### Functional Requirements
- [ ] [Specific testable requirement 1]
- [ ] [Specific testable requirement 2]

### Technical Requirements
- [ ] [Technical constraint 1]
- [ ] [Technical constraint 2]

## Implementation Guide

### Files to Modify
| File | Change | Details |
|------|--------|---------|
| `path/to/file.ts` | MODIFY | [what changes] |

### Files to Create
| File | Purpose |
|------|---------|
| `path/to/new.ts` | [what it does] |

### Implementation Steps
1. [Specific step 1]
2. [Specific step 2]
3. [Specific step 3]
4. [Continue...]

### Code Pattern to Follow
Based on codebase research, follow this pattern:
```
File: [path/to/similar.ts]
[Show the pattern from existing code]
```

### Imports Required
```
[List imports based on codebase conventions]
```

### Configuration Changes
- [ ] [New config value if needed]
- [ ] [Environment variable if needed]

### Edge Cases to Handle
| Scenario | Expected Behavior |
|----------|-------------------|
| [Edge case 1] | [How to handle] |
| [Edge case 2] | [How to handle] |

### Error Handling
| Error | Handle With | User Message |
|-------|-------------|--------------|
| [Error type] | [Pattern] | [Message] |

## Acceptance Criteria
- [ ] [Testable: When X, then Y]
- [ ] [Testable: Calling A returns B]
- [ ] [Testable: Error case handled]
- [ ] All existing tests pass
- [ ] Code follows codebase conventions

## Testing Notes
- Unit test: [specific scenarios]
- Integration test: [if applicable]
- Manual verification: [steps]

## Dependencies
- Blocked by: [task IDs or "none"]
- Blocks: [task IDs]
EOF
)"
```

Link to epic (use --parent flag when creating, or update after):
```bash
bd update <TASK-ID> --parent <EPIC-ID>
```

### 4.3 Task Quality Gate

**Before creating each task, verify:**

- [ ] **WHAT**: Can a developer understand what to build without asking questions?
- [ ] **WHERE**: Are specific file paths listed?
- [ ] **HOW**: Are implementation steps provided?
- [ ] **VERIFY**: Are acceptance criteria testable by running code?
- [ ] **CONTEXT**: Does the task explain WHY?

**Self-sufficiency test:** "Could a developer with zero context complete this task using ONLY the task description?"
- If NO → Add missing information

### 4.4 Create Test Tasks

For EACH component, create a test task:

```bash
bd create "Tests: [Component Name]" --type task --priority 2
```

```bash
bd update <TEST-ID> --notes "$(cat <<'EOF'
## Summary
Write comprehensive tests for [Component Name]

## Scope
Tests for implementation task(s): [TASK-IDs]

## Coverage Requirements
| File | Target Coverage | Focus Areas |
|------|-----------------|-------------|
| `path/to/file.ts` | >85% | [critical functions] |

Overall targets:
- Line coverage: ≥80%
- Branch coverage: ≥75%

## Test Cases Required

### Unit Tests
| Test Case | Input | Expected Output | Priority |
|-----------|-------|-----------------|----------|
| [Happy path] | [input] | [output] | High |
| [Edge case 1] | [input] | [output] | High |
| [Error case] | [input] | [error] | High |
| [Boundary] | [input] | [output] | Medium |

### Integration Tests
| Test Case | Setup | Verification |
|-----------|-------|--------------|
| [Integration 1] | [setup] | [verify] |

### Error Handling Tests
| Scenario | Trigger | Expected |
|----------|---------|----------|
| [Error 1] | [how] | [behavior] |

## Test File Locations
| Test File | Action |
|-----------|--------|
| `tests/[component].test.ts` | CREATE |
| `tests/existing.test.ts` | MODIFY (add cases) |

## Mocking Requirements
- Mock [service/module]: [responses needed]
- Mock [database]: [fixtures needed]

## Test Patterns to Follow
Based on codebase research:
```
[Example from existing test file]
```

## Acceptance Criteria
- [ ] All test cases from table implemented
- [ ] Coverage targets met (verify with coverage report)
- [ ] No flaky tests
- [ ] Tests run in reasonable time (<60s)
- [ ] Mocks are realistic
EOF
)"
```

Link test task to implementation and epic:
```bash
bd update <TEST-ID> --parent <EPIC-ID>
bd dep add <TEST-ID> <IMPL-TASK-ID>  # Test depends on implementation
```

### 4.5 Create QA Validation Tasks

**QA Task 1: Integration Validation**

```bash
bd create "QA: Integration Validation" --type task --priority 3
```

```bash
bd update <QA-ID> --notes "$(cat <<'EOF'
## Summary
Validate complete integration of all epic components

## Scope
Validates:
- Implementation tasks: [list IDs]
- Test tasks: [list IDs]

## Prerequisites
- [ ] All implementation tasks closed
- [ ] All test tasks closed
- [ ] All tests passing

## Test Scenarios

### Scenario 1: [Happy Path End-to-End]
**Preconditions:** [setup]
**Steps:**
1. [Action 1]
2. [Action 2]
3. [Action 3]
**Expected:** [outcome]
**Verified:** [ ]

### Scenario 2: [Error Handling]
**Preconditions:** [setup]
**Steps:**
1. [Trigger error condition]
**Expected:** [graceful handling]
**Verified:** [ ]

### Scenario 3: [Edge Case]
**Preconditions:** [setup]
**Steps:**
1. [Edge case trigger]
**Expected:** [correct behavior]
**Verified:** [ ]

## Integration Points
| Component A | Component B | Verification |
|-------------|-------------|--------------|
| [A] | [B] | [how to verify] |

## Performance Check
- [ ] Response time acceptable
- [ ] No memory leaks observed
- [ ] No excessive logging

## Regression Check
- [ ] [Related feature 1] still works
- [ ] [Related feature 2] still works

## Acceptance Criteria
- [ ] All scenarios pass
- [ ] All integration points verified
- [ ] No blocking bugs found
- [ ] Performance acceptable
EOF
)"
```

**QA Task 2: Acceptance Criteria Verification**

```bash
bd create "QA: Acceptance Criteria Verification" --type task --priority 3
```

```bash
bd update <QA-ID> --notes "$(cat <<'EOF'
## Summary
Verify all acceptance criteria from original specification are met

## Original Acceptance Criteria
[Copy from spec extraction in Phase 1]

## Verification Matrix
| # | Criterion | How to Verify | Status |
|---|-----------|---------------|--------|
| 1 | [criterion] | [verification steps] | [ ] |
| 2 | [criterion] | [verification steps] | [ ] |
| 3 | [criterion] | [verification steps] | [ ] |

## Documentation Check
- [ ] Code comments adequate
- [ ] README updated (if applicable)
- [ ] API documentation accurate (if applicable)

## Sign-off Criteria
- [ ] All acceptance criteria verified
- [ ] All documentation complete
- [ ] Ready for release
EOF
)"
```

Link QA tasks:
```bash
# Set parent for QA tasks
bd update <QA-INTEGRATION> --parent <EPIC-ID>
bd update <QA-ACCEPTANCE> --parent <EPIC-ID>

# QA-Integration depends on all test tasks
bd dep add <QA-INTEGRATION> <TEST-1>
bd dep add <QA-INTEGRATION> <TEST-2>

# QA-Acceptance depends on QA-Integration
bd dep add <QA-ACCEPTANCE> <QA-INTEGRATION>
```

---

## Phase 5: Verify and Validate

### 5.1 Automated Verification

Run each command and verify:

**Check 1: Epic Exists**
```bash
bd show <EPIC-ID>
```
Verify: Overview, scope, success criteria visible

**Check 2: All Tasks Created**
```bash
bd list --parent <EPIC-ID>
```
Verify: All planned tasks appear

**Check 3: Dependencies Set**
```bash
bd show <TASK-ID>  # For each task
```
Verify: Dependencies listed correctly

**Check 4: Ready Tasks Exist**
```bash
bd ready
```
Verify: At least one task can be started

### 5.2 Self-Review Checklist

Answer each question:

1. **Completeness**: "Could a developer start working immediately?"
   - [ ] YES - proceed
   - [ ] NO - identify and add missing info

2. **Clarity**: "Are there tasks where 'done' is unclear?"
   - [ ] All clear
   - [ ] Found unclear tasks - add acceptance criteria

3. **Research Quality**: "Did I reference actual code from this codebase?"
   - [ ] Yes, with specific file references
   - [ ] Generic patterns used - go back to Phase 2

4. **Dependencies**: "Is the order correct?"
   - [ ] Implementation → Tests → QA
   - [ ] No circular dependencies
   - [ ] Parallel tracks identified

5. **Coverage**: "Does every implementation have tests?"
   - [ ] All covered
   - [ ] Missing test tasks - add them

---

## Stuck Detection

Track consecutive failures. Increment stuck counter when:
- Same extraction fails twice consecutively
- Same research query returns no results twice
- Same task creation fails with same error

**Reset stuck counter when:**
- New extraction succeeds
- Different action attempted
- Different error encountered

**Threshold: 3 consecutive failures on same action → Output STUCK**

---

## Exit Conditions

### PLANNING_COMPLETE

When: All tasks created, dependencies set, verification passed

```markdown
## COMPLETE

<promise>PLANNING_COMPLETE</promise>

### Epic Created
ID: <EPIC-ID>
!bd show <EPIC-ID>

### Tasks Summary
| Type | Count | IDs |
|------|-------|-----|
| Implementation | N | [list] |
| Test | N | [list] |
| QA | N | [list] |

### Dependency Graph
```
[ASCII diagram of task flow]
```

### Ready to Start
!bd ready

### Next Steps
1. Review: `bd show <EPIC-ID>`
2. Start: `/implement-feature <EPIC-ID>` or `/next`
```

### BLOCKED:MUST_ASK

When: Phase 1.3 MUST ASK gate fails (specification ambiguity)

Output format defined in Phase 1.3 above.

### BLOCKED:RUNTIME

When: Cannot proceed due to external factor (tools unavailable, codebase inaccessible)

```markdown
## BLOCKED

<promise>BLOCKED:RUNTIME</promise>

### Blocker
[Specific external impediment]

### Attempted Solutions
[What was tried]

### Required to Unblock
[What is needed - resource, permission, etc.]

### Progress Saved
Completed phases: [list]
```

### STUCK

When: No progress after 3 consecutive identical failures

```markdown
## STUCK

<promise>STUCK</promise>

### Stuck Pattern
[Description of repeated failure]

### Recent Attempts
| Iteration | Action | Result |
|-----------|--------|--------|
| N-2 | [action] | [error] |
| N-1 | [action] | [error] |
| N | [action] | [error] |

### Alternatives Not Tried
- [Alternative approach 1]
- [Alternative approach 2]

### To Resume
Fix the underlying issue and re-run: `/plan-epic $1`
```

---

## Begin

1. Create progress tracking with TodoWrite
2. Start Phase 1: Load and analyze **$1**
3. **At Phase 1.3 MUST ASK Gate: Make GO/NO-GO decision**
   - If ANY MUST ASK condition is YES → Output BLOCKED:MUST_ASK and STOP
   - If ALL MUST ASK conditions are NO → Continue to Phase 2
4. Complete remaining phases, tracking each action as an iteration
5. Output PLANNING_COMPLETE when verification passes
