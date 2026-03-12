---
description: Perform comprehensive code quality review with quality metrics and recommendations
argument-hint: <path> [--max-iterations <N>] [--scope full|complexity|performance|maintainability|correctness]
allowed-tools: Read, Grep, Glob, Bash, Task, TodoWrite
---

# Code Quality Review (Ralph-Loop)

Autonomously performs a comprehensive code quality review of a codebase or specified paths, analyzing code complexity, maintainability, performance patterns, and correctness issues.

## Execution Modes

**Headless (run overnight, fresh context each iteration):**
```bash
./.claude/scripts/ralph/code-quality.sh $ARGUMENTS
```

**Direct (execute in this session):**
Continue below...

---

## Arguments

**Target Path:** $ARGUMENTS

Parse the arguments:
- `$1` = Path to review (required - directory, file, or glob pattern)
- `--scope` = Focus area: `full` (default), `complexity`, `performance`, `maintainability`, `correctness`
- `--max-iterations` = Safety limit (default: 50)

**Supported File Types:**
- TypeScript: `.ts`
- JavaScript: `.js`
- Python: `.py`
- Go: `.go`
- Java: `.java`
- Rust: `.rs`
- Ruby: `.rb`
- PHP: `.php`
- C: `.c`
- C++: `.cpp`
- C/C++ Headers: `.h`

---

## CRITICAL: STOP CONDITIONS

This command will **STOP** (exit the loop) when ANY of these conditions are met:

| Exit | Trigger | Promise Tag |
|------|---------|-------------|
| **COMPLETE** | All files reviewed, report generated | `<promise>QUALITY_REVIEW_COMPLETE</promise>` |
| **MUST ASK** | Any MA-1 through MA-5 condition detected | `<promise>BLOCKED:MUST_ASK</promise>` |
| **BLOCKED** | Path inaccessible, no supported files found | `<promise>BLOCKED:RUNTIME</promise>` |
| **STUCK** | 3 consecutive failures on same file | `<promise>STUCK</promise>` |
| **MAX_ITER** | Iteration count exceeds --max-iterations | `<promise>MAX_ITERATIONS_REACHED</promise>` |

### MUST ASK Condition Mapping

| Code | Condition | Severity |
|------|-----------|----------|
| MA-1 | Critical Security Vulnerability (injection, hardcoded secrets) | CRITICAL |
| MA-2 | Breaking API Change (public interface modified) | CRITICAL |
| MA-3 | Architectural Violation (circular deps, layer breach) | HIGH |
| MA-4 | License/Compliance Issue (GPL in proprietary, missing headers) | CRITICAL |
| MA-5 | Data Loss Risk (destructive operation without safeguard) | CRITICAL |

**When you output a `<promise>` tag:**
- This is your FINAL output for the command
- Do NOT continue processing after outputting a promise
- Do NOT attempt workarounds when MUST ASK conditions are met

---

## Progress Tracking

Use TodoWrite to track iteration progress. **Each file = one iteration.**

### Initial TodoWrite Setup (Phase 1)

```markdown
- [ ] Phase 1: Initialize and build file queue
- [ ] Phase 2: Iterate through files (0/N analyzed)
- [ ] Phase 3: Generate quality report
```

### Per-Iteration TodoWrite Updates (Phase 2)

**After EACH file analysis, update TodoWrite:**

```markdown
- [x] Phase 1: Initialize and build file queue
- [ ] Phase 2: Iterate through files (3/47 analyzed)
      - [x] src/index.ts - 2 issues (0 CRITICAL)
      - [x] src/utils/helper.ts - 0 issues
      - [x] src/api/routes.ts - 1 issue (0 CRITICAL)
      - [ ] src/components/Button.tsx (next)
      - [ ] ... (44 remaining)
- [ ] Phase 3: Generate quality report
```

### State Tracking Variables

Track these throughout execution:

```
iteration_counter: 0     # Incremented after each file
stuck_counter: 0         # Reset on success, increment on failure
max_iterations: 50       # From --max-iterations flag
total_files: N           # Set in Phase 1
files_analyzed: 0        # Incremented after each successful analysis
findings: []             # Accumulated issues
```

---

## Phase 1: Initialize

### 1.1 Validate Target Path

!ls -la "$1" 2>/dev/null || echo "ERROR: Path not found"

If path doesn't exist or is inaccessible:
```
## BLOCKED

<promise>BLOCKED:RUNTIME</promise>

### Error
Target path does not exist or is not accessible: $1

### Type
Runtime - path validation failed

### Required
Provide a valid path to review.
```

### 1.2 Scan Directory Structure

Identify:
- Directory organization
- Total file count (all types)
- Supported file count (by extension)
- Technology stack detected
- Language distribution
- Project structure patterns

### 1.3 Build File Queue

Discover ALL files matching supported extensions in the target path using the Glob tool:

```
Use Glob tool for each extension:
- Glob pattern: "$1/**/*.ts" (TypeScript)
- Glob pattern: "$1/**/*.js" (JavaScript)
- Glob pattern: "$1/**/*.py" (Python)
- Glob pattern: "$1/**/*.go" (Go)
- Glob pattern: "$1/**/*.java" (Java)
- Glob pattern: "$1/**/*.rs" (Rust)
- Glob pattern: "$1/**/*.rb" (Ruby)
- Glob pattern: "$1/**/*.php" (PHP)
- Glob pattern: "$1/**/*.c" (C)
- Glob pattern: "$1/**/*.cpp" (C++)
- Glob pattern: "$1/**/*.h" (Headers)

Combine results and sort for deterministic ordering.
```

If NO supported files found:
```
## BLOCKED

<promise>BLOCKED:RUNTIME</promise>

### Error
No supported file types found in target path: $1

### Supported Types
.ts, .js, .py, .go, .java, .rs, .rb, .php, .c, .cpp, .h

### Options
1. Specify a different path containing source files
2. Include specific directories in the path
```

Document:
- Total files discovered: [count]
- By extension: [breakdown]
- Estimated total lines of code (rough count)

### 1.4 Load Project Context

Scan for:
- Package manifests (package.json, requirements.txt, go.mod, Cargo.toml, pom.xml, etc.)
- Configuration files (.eslintrc, .pylintrc, tsconfig.json, etc.)
- Test files and test coverage setup
- Documentation (README, CONTRIBUTING, etc.)
- CI/CD configuration (GitHub Actions, GitLab CI, etc.)

Document findings in context section.

### 1.5 Determine Scope

Based on `--scope` flag:

| Scope | Categories | Focus |
|-------|-----------|-------|
| `full` | Complexity, Performance, Maintainability, Correctness, Security | All dimensions |
| `complexity` | Cyclomatic complexity, cognitive complexity, nesting depth | Code structure |
| `performance` | Algorithmic efficiency, resource usage, caching, N+1 queries | Runtime behavior |
| `maintainability` | Naming, documentation, modularity, duplication, test coverage | Long-term health |
| `correctness` | Type safety, error handling, edge cases, null checks, logic errors | Functional quality |

---

## Phase 2: Iterate Through Files

### 2.1 File Selection Loop

For each file in the queue:

```
ITERATION {n}
├── SELECT: Next file from queue
├── LOAD: Read file content
├── ANALYZE: Extract metrics and issues
├── CLASSIFY: Assign severity
├── EVALUATE: Check MUST_ASK conditions
├── RECORD: Store findings
└── NEXT: Continue or exit
```

### 2.2 Per-File Analysis

For each file, analyze:

#### Metric 1: Code Complexity

Measure:
- **Cyclomatic Complexity**: Number of distinct paths through code
  - Good: 1-5
  - Acceptable: 6-10
  - Poor: 11-20
  - Very Poor: >20
- **Cognitive Complexity**: Nesting depth, conditional branches
  - Good: <10
  - Acceptable: 10-20
  - Poor: 21-50
  - Very Poor: >50
- **Nesting Depth**: Maximum indentation level
  - Good: ≤3
  - Acceptable: 4-5
  - Poor: 6-8
  - Very Poor: >8

Issues to flag:
- Long functions (>50 lines) with high complexity
- Deeply nested conditionals (>4 levels)
- Functions without clear single responsibility

#### Metric 2: Code Maintainability

Measure:
- **Function Length**: Lines per function
  - Good: <30 lines
  - Acceptable: 30-75 lines
  - Poor: 76-150 lines
  - Very Poor: >150 lines
- **Class/Module Size**: Total lines
  - Good: <300 lines
  - Acceptable: 300-600 lines
  - Poor: 601-1000 lines
  - Very Poor: >1000 lines
- **Method Count per Class**: Number of public methods
  - Good: <10
  - Acceptable: 10-20
  - Poor: 21-30
  - Very Poor: >30
- **Naming Quality**
  - Variables/functions using single letters (except loop counters)
  - Abbreviations used inconsistently
  - Generic names (data, temp, value, result)
  - No/poor documentation
- **Code Duplication**
  - Exact duplicates (>10 lines)
  - Similar blocks (high similarity threshold)
  - Copy-paste patterns

Issues to flag:
- Functions/methods with unclear names
- Poor separation of concerns
- Missing or unclear documentation
- Similar code blocks that should be extracted

#### Metric 3: Performance Patterns

Scan for:
- **Algorithmic Issues**
  - Nested loops without clear boundary
  - Quadratic operations in loops
  - No early exit from loops
  - Inefficient list operations (searching unindexed)
- **Resource Usage**
  - Unbounded memory allocation
  - Large temporary data structures in loops
  - Missing resource cleanup (file handles, connections)
  - Circular data structure references
- **Database/Query Patterns**
  - N+1 query patterns (loading data in loops)
  - No query optimization (missing indexes)
  - Fetching entire result sets for filtering
  - No pagination on large queries
- **Caching**
  - Repeated expensive operations without caching
  - Cache invalidation issues
  - Cache stampede patterns
- **I/O Operations**
  - Synchronous I/O in hot paths
  - Missing batching for I/O operations
  - No connection pooling
  - Blocking operations in parallel contexts

Issues to flag:
- Potential O(n²) or worse algorithms
- Uncontrolled loops or recursion
- Missing caching opportunities
- Inefficient data access patterns

#### Metric 4: Correctness & Safety

Scan for:
- **Type Safety** (language-specific)
  - Any types or loose typing overuse
  - Missing null checks
  - Type assertions without validation
  - Generic type constraints not enforced
- **Error Handling**
  - Uncaught exceptions
  - Ignored error returns
  - Broad exception catches without re-throw
  - Silent failures
  - Generic error messages
- **Edge Cases**
  - Off-by-one errors in loops
  - Boundary conditions not checked
  - Empty collection handling
  - Null/undefined handling
  - Division by zero checks
- **Logic Errors**
  - Unreachable code
  - Dead branches after return
  - Inverted boolean conditions
  - Missing case in switch statements
  - Resource leaks (unclosed files, connections)
- **Concurrency Issues** (if applicable)
  - Race conditions
  - Deadlock potential
  - Missing synchronization
  - Non-thread-safe code in concurrent context

Issues to flag:
- Missing null safety checks
- Uncaught exceptions
- Incorrect boundary handling
- Potential resource leaks

#### Metric 5: Security & Best Practices

Scan for (non-exhaustive - see security-review for full coverage):
- Hardcoded secrets/credentials
- SQL injection patterns (string concatenation in queries)
- Insufficient input validation
- Insecure deserialization
- Missing authentication/authorization checks
- Weak cryptography
- Information disclosure in errors/logs
- Command injection patterns

Note: Refer findings to security-review for detailed analysis if found.

### 2.3 Issue Severity Classification

| Severity | Impact | Action |
|----------|--------|--------|
| **CRITICAL** | Breaks functionality, security risk, data loss risk | MUST_ASK if not understood |
| **HIGH** | Significant quality issue, likely bugs, security concern | Include in report, prioritize fix |
| **MEDIUM** | Code smell, maintainability issue, minor inefficiency | Include in report, address in normal work |
| **LOW** | Style/convention issue, minor improvement opportunity | Include in report for awareness |
| **INFO** | Positive finding, note for completeness | Include in report for context |

### 2.4 Record Findings

For each issue found, record:

```
FILE: /absolute/path/to/file.ext
LINE(S): [line number or range]
CATEGORY: [complexity|performance|maintainability|correctness|security]
ISSUE: [Title of issue]
SEVERITY: [CRITICAL|HIGH|MEDIUM|LOW|INFO]
DESCRIPTION: [2-3 sentence explanation]
PATTERN: [Code snippet or description of what was found]
RECOMMENDATION: [Specific fix or improvement]
```

Store findings with line numbers for later reference in report.

### 2.5 Stuck Detection

Track consecutive analysis failures on same file:

- **Increment stuck counter** when:
  - File fails to parse
  - Same metric fails to calculate
  - File size makes analysis timeout

- **Reset stuck counter** when:
  - Analysis succeeds on any file
  - Successfully move to next file

- **Threshold: 3 consecutive failures on SAME file** → Output STUCK and **HALT**

---

### 2.6 Iteration Exit Check [CRITICAL - EVALUATE AFTER EVERY FILE]

**After analyzing EACH file, evaluate exit conditions in this EXACT order:**

```
┌─────────────────────────────────────────────────────────────────┐
│                    ITERATION EXIT CHECK                          │
│              (Run this after EVERY file analysis)                │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. MUST ASK CHECK                                               │
│     IF any MA-1 through MA-5 detected in this file:             │
│     └─→ Output <promise>BLOCKED:MUST_ASK</promise>              │
│     └─→ STOP IMMEDIATELY - Do NOT continue to next file         │
│                                                                   │
│  2. STUCK CHECK                                                  │
│     IF stuck_counter >= 3 on same file:                         │
│     └─→ Output <promise>STUCK</promise>                          │
│     └─→ STOP IMMEDIATELY - Do NOT continue                       │
│                                                                   │
│  3. MAX ITERATIONS CHECK                                         │
│     IF current_iteration >= max_iterations:                      │
│     └─→ Output <promise>MAX_ITERATIONS_REACHED</promise>         │
│     └─→ STOP IMMEDIATELY - Report partial progress               │
│                                                                   │
│  4. COMPLETION CHECK                                             │
│     IF file_queue is empty (all files processed):               │
│     └─→ Proceed to Phase 3: Finalize                             │
│     └─→ Generate report                                          │
│     └─→ Output <promise>QUALITY_REVIEW_COMPLETE</promise>        │
│                                                                   │
│  5. CONTINUE CHECK                                               │
│     IF none of above:                                            │
│     └─→ Increment iteration counter                              │
│     └─→ Update TodoWrite progress                                │
│     └─→ LOOP BACK to next file in queue                          │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

**CRITICAL RULE**: When a MUST ASK condition fires, you MUST stop immediately.

**Do NOT:**
- Continue processing remaining files
- Try to work around the issue
- Defer the decision to the final report

**Do:**
- Output the appropriate `<promise>` tag
- Include all findings collected so far
- Provide clear context for the blocker

---

## Phase 3: Finalize

### 3.1 Aggregate Findings

Consolidate all findings:

1. **Group by Category**
   - Complexity issues
   - Performance issues
   - Maintainability issues
   - Correctness issues
   - Security issues

2. **Group by Severity**
   - CRITICAL findings
   - HIGH findings
   - MEDIUM findings
   - LOW findings
   - INFO findings

3. **Calculate Metrics**
   - Total files analyzed
   - Total issues found
   - Average complexity across files
   - Files exceeding quality thresholds
   - Lines of code analyzed

### 3.2 Identify Hotspots

Determine files requiring attention:

```
Hotspot Analysis
├── Most Complex Files
│   - File with highest cyclomatic complexity
│   - File with most issue density (issues/LOC)
│   - File with most violations
├── Highest Risk Files
│   - Most CRITICAL issues
│   - Most HIGH severity issues
│   - Most security-related issues
└── Most Duplicated Code
    - Files with highest duplication ratio
    - Similar code blocks across files
```

### 3.3 Generate Recommendations

Create actionable recommendations:

1. **Immediate Actions (P0)**
   - Critical issues requiring urgent fix
   - Security vulnerabilities
   - Data loss risks

2. **High Priority (P1)**
   - Complex functions to refactor
   - Missing error handling
   - Performance bottlenecks

3. **Medium Priority (P2)**
   - Maintainability improvements
   - Documentation gaps
   - Code duplication to address

4. **Low Priority (P3)**
   - Style/convention issues
   - Minor improvements
   - Best practice updates

### 3.4 Calculate Quality Score

Generate overall quality score (0-100):

```
Base: 100 points

Deductions:
- Each CRITICAL issue: -5 points (max -25)
- Each HIGH issue: -1 point (max -20)
- Each MEDIUM issue: -0.5 points (max -10)
- Each LOW issue: -0.1 points (max -5)

Additional factors:
- Test coverage: +5 if >80%, +2 if >50%, -5 if <20%
- Documentation: +5 if well-documented, -3 if missing
- Code duplication: -2 for each 5% above 10%
- Average complexity: -3 for each unit over 10

Final score: max(0, 100 - deductions)
```

Quality Rating:
- 90-100: Excellent
- 80-89: Good
- 70-79: Acceptable
- 60-69: Needs Work
- <60: Poor

---

## MUST_ASK Stop Conditions

**IMMEDIATELY pause and ask when ANY of these conditions are met:**

### MA-1: Critical Security Vulnerability

```
[CODE QUALITY REVIEW PAUSED - CRITICAL SECURITY FINDING]

<promise>BLOCKED:MUST_ASK</promise>

Finding: [vulnerability type, e.g., hardcoded API key]
Location: [file:line]
Severity: CRITICAL
Evidence: [code snippet - secrets REDACTED]

Details:
- Type: [injection|hardcoded_secret|auth_bypass|data_exposure]
- Risk: [specific security risk]

Question: This security issue requires immediate remediation. Should I:
(a) Continue review and include in comprehensive report
(b) Stop here to fix immediately
(c) Provide detailed remediation guidance

Blocking: Yes - Critical security finding requires human decision
```

### MA-2: Breaking API Change Risk

```
[CODE QUALITY REVIEW PAUSED - BREAKING CHANGE DETECTION]

<promise>BLOCKED:MUST_ASK</promise>

Finding: Potential breaking API change
Location: [file:line]
Severity: CRITICAL

Details:
- Public interface modified: [what changed]
- Downstream impact: [affected code]
- Risk: [version compatibility issue]

Question: Is this public API interface modification intentional?
- If public API: requires version bump
- If internal: verify all callers updated
- If being deprecated: needs deprecation warning

Blocking: Yes - Breaking changes require human verification
```

### MA-3: Architectural Violation

```
[CODE QUALITY REVIEW PAUSED - ARCHITECTURAL CONCERN]

<promise>BLOCKED:MUST_ASK</promise>

Finding: Potential architecture/design violation
Location: [file:line, file2:line2, ...]
Severity: HIGH

Details:
- Violation: [circular dependency|layer breach|pattern violation]
- Pattern: [description of the violation]
- Affected components: [list of files/modules]

Evidence:
- File A imports File B which imports File A (circular)
- Or: Presentation layer directly accessing database layer
- Or: Violating established pattern throughout codebase

Question: Is this architectural violation intentional or should it be fixed?

Blocking: Yes - Architectural decisions require human input
```

### MA-4: License/Compliance Issue

```
[CODE QUALITY REVIEW PAUSED - COMPLIANCE CONCERN]

<promise>BLOCKED:MUST_ASK</promise>

Finding: License or compliance issue detected
Location: [file path]
Severity: CRITICAL

Details:
- Issue: [GPL in proprietary|missing license header|compliance violation]
- Affected code: [description]
- Risk: [legal/compliance risk]

Question: Is this file correctly licensed/compliant with project license?

Blocking: Yes - License compliance requires human verification
```

### MA-5: Data Loss Risk

```
[CODE QUALITY REVIEW PAUSED - DATA LOSS RISK]

<promise>BLOCKED:MUST_ASK</promise>

Finding: Potential data loss or corruption risk
Location: [file:line]
Severity: CRITICAL

Details:
- Risk: [destructive operation without validation|data corruption potential]
- Scenario: [how data could be lost]
- Impact: [what data affected]

Evidence:
- Code performing destructive operation: [pattern]
- Missing safeguards: [delete/truncate without confirmation, etc.]

Question: Is there a safeguard preventing accidental data loss?
- Soft delete instead of permanent delete?
- Confirmation before destructive operations?
- Transaction rollback capability?

Blocking: Yes - Data loss risks require human verification
```

---

## Output Structure

### Report Format

```
═══════════════════════════════════════════════════════════════════
                    CODE QUALITY REVIEW REPORT
                        [Project Name/Date]
═══════════════════════════════════════════════════════════════════

EXECUTIVE SUMMARY
─────────────────────────────────────────────────────────────────

Quality Score: [X/100] ([Rating: Excellent|Good|Acceptable|Needs Work|Poor])

Files Reviewed: [X]
Total Lines of Code: [X]
Languages Analyzed: [language list]

Findings Summary:
• CRITICAL: [X] - Requires immediate action
• HIGH:     [X] - Address before release
• MEDIUM:   [X] - Address in normal work
• LOW:      [X] - For awareness

═══════════════════════════════════════════════════════════════════

CODEBASE OVERVIEW
─────────────────────────────────────────────────────────────────

Directory Structure:
[Show main structure]

Technology Stack:
- Languages: [list]
- Frameworks: [list]
- Build System: [type]
- Testing Framework: [type]

Metrics:
- Total Files: [count]
- Supported Files: [count] ([%])
- Total LOC: [estimate]
- Average File Size: [lines]
- Test Coverage: [%] (if detectable)

═══════════════════════════════════════════════════════════════════

ISSUES BY CATEGORY
─────────────────────────────────────────────────────────────────

[Repeat for each category: Complexity, Performance, Maintainability, Correctness, Security]

### Category: [Name]
Status: [X issues found]

[For each issue at this severity level:]

ISSUE [#]: [Title]
Severity: [CRITICAL|HIGH|MEDIUM|LOW]
Location: /path/to/file.ext:line
Category: [category]

Description:
[2-3 sentence explanation of the issue and why it matters]

Evidence:
[Code snippet or pattern description]

Impact:
[How this affects code quality/functionality]

Recommendation:
[Specific action to resolve this issue]

Example Fix:
[If applicable, show code change or approach]

───────────────────────────────────────────────────────────────────

═══════════════════════════════════════════════════════════════════

CODE METRICS ANALYSIS
─────────────────────────────────────────────────────────────────

### Complexity Analysis

Average Cyclomatic Complexity: [X.X]
- Target: <10
- Status: [Good|Acceptable|Poor]

Files Exceeding Threshold:
| File | Complexity | Recommendation |
|------|-----------|-----------------|
| [file] | [value] | [action] |

Cognitive Complexity:
- Average: [X]
- Max: [X] in [file]

### Maintainability Analysis

Average Function Length: [X] lines
- Target: <30
- Status: [Good|Acceptable|Poor]

Largest Functions:
| File | Function | Lines | Recommendation |
|------|----------|-------|-----------------|
| [file] | [name] | [count] | Refactor |

Average Class Size: [X] lines
- Target: <300
- Status: [Good|Acceptable|Poor]

Code Duplication: [X%]
- Target: <10%
- Status: [Good|Acceptable|Poor]

Duplicated Blocks:
| Location 1 | Location 2 | Lines | Action |
|-----------|-----------|-------|--------|
| [file1:line] | [file2:line] | [count] | Extract |

Documentation Coverage:
- Documented functions: [X%]
- Documented classes: [X%]
- README quality: [Present|Missing|Incomplete]

### Performance Analysis

Potential Bottlenecks:
| File | Issue | Impact | Recommendation |
|------|-------|--------|-----------------|
| [file] | [pattern] | [impact] | [fix] |

Database Query Patterns:
- N+1 query risk: [Found|Not found] at [locations]
- Missing pagination: [Count] locations
- Inefficient joins: [Status]

Caching Opportunities:
| Location | Frequency | Potential Savings | Recommendation |
|----------|-----------|-------------------|-----------------|
| [file:func] | [frequency] | [estimate] | [action] |

### Correctness Analysis

Type Safety Issues: [X found]
- Missing null checks: [X]
- Unsafe type casts: [X]
- Unvalidated external input: [X]

Error Handling:
- Uncaught exception patterns: [X found]
- Silent failures: [X found]
- Generic error messages: [X found]

Edge Case Handling:
- Off-by-one errors: [X found]
- Boundary condition issues: [X found]
- Empty collection handling: [status]

Resource Management:
- Potential leaks: [X found]
- Unclosed resources: [X found]
- Circular references: [X found]

═══════════════════════════════════════════════════════════════════

HOTSPOTS & HIGH-RISK FILES
─────────────────────────────────────────────────────────────────

### Files Requiring Immediate Attention

**Hotspot 1:** [File Path]
- Issue count: [X] ([X CRITICAL], [X HIGH])
- Complexity: [rating]
- Size: [lines]
- Recommendation: [Prioritize refactoring]

**Hotspot 2:** [File Path]
- [Details...]

### Complexity Concentration

Top 5 Most Complex Files:
| File | Cyclomatic Complexity | Cognitive Complexity | Action |
|------|----------------------|----------------------|--------|
| [file] | [value] | [value] | Refactor |

### Duplication Hotspots

Most Duplicated Code:
| Pattern | Locations | Action |
|---------|-----------|--------|
| [pattern] | [file1], [file2], [file3] | Extract shared function |

═══════════════════════════════════════════════════════════════════

RECOMMENDATIONS & ACTION PLAN
─────────────────────────────────────────────────────────────────

### Phase 1: Critical (Immediate)
**Timeline: This sprint**

[ ] [Issue 1] - [Specific action]
    Files: [list]
    Effort: [estimate]
    Impact: [why critical]

[ ] [Issue 2] - [Specific action]
    Files: [list]
    Effort: [estimate]
    Impact: [why critical]

### Phase 2: High Priority (Next Sprint)
**Timeline: Next sprint**

[ ] [Issue 1] - [Specific action]
    Files: [list]
    Effort: [estimate]
    Impact: [benefit]

### Phase 3: Medium Priority (Next 2 Sprints)
**Timeline: Within 2 sprints**

[ ] [Issue 1] - [Specific action]
    Files: [list]
    Effort: [estimate]
    Impact: [benefit]

### Phase 4: Low Priority (Backlog)
**Timeline: As part of ongoing maintenance**

[ ] [Issue 1] - [Specific action]
    Files: [list]
    Effort: [estimate]
    Impact: [benefit]

### Quick Wins

Issues that can be fixed quickly for immediate impact:
- [Issue 1]: ~[time] effort, [benefit]
- [Issue 2]: ~[time] effort, [benefit]

═══════════════════════════════════════════════════════════════════

POSITIVE FINDINGS
─────────────────────────────────────────────────────────────────

[Recognition of quality-positive patterns and implementations]

✓ Well-documented codebase in [areas]
✓ Consistent error handling in [modules]
✓ Good test coverage in [areas]
✓ Effective separation of concerns in [components]
✓ Clear naming conventions followed

═══════════════════════════════════════════════════════════════════

NEXT STEPS
─────────────────────────────────────────────────────────────────

1. **Review This Report**
   - Discuss findings with team
   - Prioritize recommendations
   - Plan implementation

2. **Establish Quality Gates**
   - Define acceptable complexity thresholds
   - Set test coverage targets
   - Establish naming/style guidelines

3. **Refactoring Strategy**
   - Start with high-risk hotspots
   - Extract common patterns
   - Improve test coverage

4. **Continuous Monitoring**
   - Integrate quality checks in CI/CD
   - Track metrics over time
   - Regular quality reviews (monthly/quarterly)

═══════════════════════════════════════════════════════════════════
```

---

## Exit Conditions

### QUALITY_REVIEW_COMPLETE

When: All files reviewed, analysis complete, report generated

```markdown
## COMPLETE

<promise>QUALITY_REVIEW_COMPLETE</promise>

### Summary

Quality Score: [X/100] - [Rating]

**Findings by Severity:**
- CRITICAL: [X]
- HIGH: [X]
- MEDIUM: [X]
- LOW: [X]

**By Category:**
- Complexity Issues: [X]
- Performance Issues: [X]
- Maintainability Issues: [X]
- Correctness Issues: [X]
- Security Issues: [X]

### Files Analyzed: [X]
### Total Lines Reviewed: [X]
### Analysis Duration: [time]

### Top Hotspots
1. [File] - [primary issue]
2. [File] - [primary issue]
3. [File] - [primary issue]

### Key Recommendations
1. [P0 action]
2. [P1 action]
3. [P2 action]

### Full Report
[Complete report above]
```

### MUST_ASK_CRITICAL

When: MA-1 through MA-5 conditions detected

Output format defined in MUST_ASK section above.

### BLOCKED:RUNTIME

When: Path inaccessible, no supported files, or other runtime error

Output format defined in Phase 1.1 above.

### MAX_ITERATIONS_REACHED

When: Iteration count exceeds --max-iterations limit

```markdown
## MAX ITERATIONS REACHED

<promise>MAX_ITERATIONS_REACHED</promise>

### Limit
Maximum iterations: [max_iterations]
Iterations completed: [iteration_counter]

### Progress Summary
Files analyzed: [count] of [total]
Files remaining: [remaining_count]

### Findings So Far
**By Severity:**
- CRITICAL: [X]
- HIGH: [X]
- MEDIUM: [X]
- LOW: [X]

### Partial Quality Score
Score: [X/100] (based on files analyzed)

### To Continue
Re-run with higher limit:
`/code-quality-review $1 --max-iterations [higher_limit]`

Or review partial findings above and decide if more analysis is needed.
```

### STUCK

When: Same file fails analysis 3 consecutive times

```markdown
## STUCK

<promise>STUCK</promise>

### Analysis Stuck On
File: [path]

### Attempts
- Iteration N: [approach] → [error]
- Iteration N+1: [approach] → [error]
- Iteration N+2: [approach] → [error]

### Issue
[Description of why analysis cannot proceed]

### Files Completed So Far
[List of successfully analyzed files with issue counts]

### To Resume
1. Fix the underlying issue (corrupt file, encoding problem, etc.)
2. Re-run: `/code-quality-review $1 --max-iterations [N]`

### Progress Saved
[Summary of findings collected so far, number of files analyzed]
```

---

## Begin [RALPH LOOP EXECUTION]

**Initialize state:**
```
iteration_counter = 0
stuck_counter = 0
current_file = null
findings = []
file_queue = []
```

### Execution Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         PHASE 1: INITIALIZE                      │
├─────────────────────────────────────────────────────────────────┤
│  1. Create TodoWrite with initial tasks                          │
│  2. Validate target path exists                                  │
│     └─→ IF path invalid: <promise>BLOCKED:RUNTIME</promise>     │
│  3. Scan and build file_queue using Glob                         │
│     └─→ IF no files: <promise>BLOCKED:RUNTIME</promise>         │
│  4. Load project context                                         │
│  5. Record: "Phase 1 complete. Found N files to analyze."        │
│                                                                   │
│  └─→ Proceed to PHASE 2                                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PHASE 2: FILE ITERATION LOOP                  │
│                    ═══════════════════════════                   │
│                    This is the RALPH LOOP                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  ITERATION {n}                                             │  │
│  │                                                             │  │
│  │  1. SELECT: Pop next file from queue                       │  │
│  │     current_file = file_queue.shift()                      │  │
│  │                                                             │  │
│  │  2. LOAD: Read file content                                │  │
│  │     IF read fails: increment stuck_counter, retry          │  │
│  │                                                             │  │
│  │  3. ANALYZE: Run metrics (complexity, maintainability,     │  │
│  │              performance, correctness, security)           │  │
│  │                                                             │  │
│  │  4. CLASSIFY: Assign severity to each issue                │  │
│  │     Check for CRITICAL issues → potential MUST ASK         │  │
│  │                                                             │  │
│  │  5. EVALUATE: Check MUST ASK conditions (MA-1 to MA-5)     │  │
│  │     IF any MUST ASK triggered:                             │  │
│  │     └─→ Output <promise>BLOCKED:MUST_ASK</promise>        │  │
│  │     └─→ HALT IMMEDIATELY                                   │  │
│  │                                                             │  │
│  │  6. RECORD: Store findings for this file                   │  │
│  │     findings.push(file_findings)                           │  │
│  │     stuck_counter = 0 (reset on success)                   │  │
│  │                                                             │  │
│  │  7. UPDATE: TodoWrite progress                             │  │
│  │     Mark current file as completed                         │  │
│  │     iteration_counter++                                    │  │
│  │                                                             │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                    │
│                              ▼                                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  EXIT EVALUATION (Run after EVERY iteration)              │  │
│  │                                                             │  │
│  │  Check in ORDER:                                           │  │
│  │                                                             │  │
│  │  1. MUST ASK? → <promise>BLOCKED:MUST_ASK</promise> HALT  │  │
│  │  2. STUCK >= 3? → <promise>STUCK</promise> HALT           │  │
│  │  3. iteration >= max? → <promise>MAX_ITERATIONS...</promise>│ │
│  │  4. queue empty? → Proceed to PHASE 3                      │  │
│  │  5. Otherwise → LOOP BACK to next iteration                │  │
│  │                         ▲                                   │  │
│  └─────────────────────────┼───────────────────────────────────┘  │
│                            │                                      │
│         ┌──────────────────┘                                      │
│         │  LOOP BACK                                              │
│         │  (continue while queue not empty                        │
│         │   AND no exit condition triggered)                      │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ (only when queue empty)
┌─────────────────────────────────────────────────────────────────┐
│                         PHASE 3: FINALIZE                        │
├─────────────────────────────────────────────────────────────────┤
│  1. Aggregate all findings by category and severity              │
│  2. Calculate quality score (0-100)                              │
│  3. Identify hotspots                                            │
│  4. Generate prioritized recommendations                         │
│  5. Format complete report                                       │
│  6. Output:                                                      │
│                                                                   │
│     <promise>QUALITY_REVIEW_COMPLETE</promise>                   │
│                                                                   │
│     [Full report follows]                                        │
└─────────────────────────────────────────────────────────────────┘
```

### Per-Iteration TodoWrite Updates

Each iteration MUST update TodoWrite:

```markdown
Iteration 1: Analyzing src/index.ts (1/47)
Iteration 2: Analyzing src/utils/helper.ts (2/47)
...
Iteration N: Analyzing src/api/routes.ts (N/47)
```

### Critical Enforcement Rules

1. **NEVER skip the exit evaluation** - run it after EVERY file
2. **NEVER continue after outputting a promise** - that's your FINAL output
3. **ALWAYS increment iteration_counter** - needed for max-iterations check
4. **ALWAYS update TodoWrite** - provides visibility into progress
5. **ALWAYS check MUST ASK first** - it takes priority over other exits
