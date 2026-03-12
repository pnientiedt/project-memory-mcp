---
description: Process all documents in a folder and produce consolidated requirements documentation
argument-hint: <folder-path> [--output <path>]
allowed-tools: Read, Glob, Grep, Bash, Task, TodoWrite
---

# Research to Requirements

Autonomously process all documents in **$1** and synthesize consolidated requirements documentation.

## Execution Modes

**Headless (run overnight, fresh context each iteration):**
```bash
./.claude/scripts/ralph/research.sh $ARGUMENTS
```

**Direct (execute in this session):**
Continue below...

---

Supported formats: `.md`, `.txt`, `.pdf`, `.docx`

## CRITICAL: STOP CONDITIONS

This command will **STOP** (exit the loop) when ANY of these conditions are met:

| Exit | Trigger | Promise Tag |
|------|---------|-------------|
| **COMPLETE** | All documents processed, requirements synthesized | `<promise>REQUIREMENTS_COMPLETE</promise>` |
| **MUST ASK** | Contradictory requirements, critical ambiguity, scope conflict, priority conflict, or incomplete requirements | `<promise>BLOCKED:MUST_ASK</promise>` |
| **RUNTIME BLOCKED** | Folder empty, no readable documents, output path not writable | `<promise>BLOCKED:RUNTIME</promise>` |
| **STUCK** | Same document fails to parse 3 times consecutively | `<promise>STUCK</promise>` |

**When you output a `<promise>` tag:**
- This is your FINAL output for the command
- Do NOT continue processing after outputting a promise
- Do NOT attempt workarounds when MUST ASK conditions are met

---

## Progress Tracking

Use TodoWrite to track iteration progress. Each document = one iteration.

```
PHASE 1: Initialize [GATE]
├── Validate folder accessibility
├── Scan for supported documents
├── Build document queue
└── Initialize requirements structure
    └── If fails → BLOCKED:RUNTIME

PHASE 2: Iterate (per document) [RALPH LOOP]
├── Read document content
├── Extract requirements
├── Categorize (functional/non-functional/constraints)
├── Deduplicate against existing
├── Track provenance
├── MUST ASK Gate [STOP POINT] ◄── If ANY YES → BLOCKED:MUST_ASK
├── Update progress
└── Exit check → Loop or proceed to Phase 3

PHASE 3: Finalize (only if all MUST ASK checks passed)
├── Consolidate all requirements
├── Generate traceability matrix
├── Create output document
└── Output REQUIREMENTS_COMPLETE
```

---

## Phase 1: Initialize [GATE]

**This phase MUST complete before iteration begins. If this phase outputs BLOCKED, the command terminates.**

### 1.1 Validate Folder

Check the source folder:
- Folder exists and is accessible
- Folder is not empty
- Contains at least one supported document type
- **Security:** Validate folder is within expected project workspace (avoid processing system directories like `/etc`, `/var`, etc.)

**If folder validation fails:**

```markdown
## BLOCKED

<promise>BLOCKED:RUNTIME</promise>

### Folder Validation Failed

| Check | Status | Details |
|-------|--------|---------|
| Folder exists | [PASS/FAIL] | [path] |
| Accessible | [PASS/FAIL] | [permission details] |
| Contains documents | [PASS/FAIL] | [count] |

### To Unblock
[Specific action needed]
```

### 1.2 Scan for Documents

Use Glob to find all supported documents:
```
Pattern: **/*.{md,txt,pdf,docx}
```

Build a document queue with:
- File path
- Format type
- File size
- Processing status (QUEUED)

**Document Queue Format:**

| # | File | Format | Size | Status |
|---|------|--------|------|--------|
| 1 | [filename] | md | [size] | QUEUED |
| 2 | [filename] | pdf | [size] | QUEUED |
| ... | ... | ... | ... | ... |

### 1.3 Initialize Requirements Structure

Create empty structures for:

**Requirements Accumulator:**
- Functional requirements (user-facing features, behaviors)
- Non-functional requirements (performance, security, scalability)
- Constraints (technical, regulatory, architectural)
- Assumptions (implicit requirements, preconditions)

**Tracking Structures:**
- Provenance map: requirement_id → [source_docs, line_refs]
- Deduplication index: normalized_text → canonical_id
- Conflict register: [conflicting_pairs with sources]

### 1.4 Phase 1 Gate

**Before proceeding, verify:**
- [ ] Folder accessible
- [ ] At least 1 document found
- [ ] Document queue created
- [ ] Requirements structure initialized

**If any check fails → Output BLOCKED:RUNTIME and STOP**

---

## Phase 2: Iterate [RALPH LOOP]

**Process ONE document per iteration. Track each as a separate step.**

### 2.1 Document Reading

For each document in the queue:

1. **Mark as IN_PROGRESS** in TodoWrite
2. **Read document content:**
   - `.md`, `.txt`: Read directly with Read tool
   - `.pdf`: Read directly with Read tool (Claude can read PDFs)
   - `.docx`: Convert with `pandoc file.docx -t markdown` or read if available

3. **Handle read failures:**
   - If document unreadable, increment stuck counter
   - If stuck counter >= 3 on same document → STUCK

### 2.2 Requirements Extraction

For each document, extract ALL requirement statements.

**Identify requirements by:**
- Explicit markers: "requirement", "shall", "must", "should", "will"
- List structures: numbered items, bullet points
- Acceptance criteria sections
- Constraint statements
- Performance targets

**For each extracted requirement, capture:**

| Field | Value |
|-------|-------|
| ID | REQ-[doc_hash]-[seq] |
| Raw Text | [exact text from source] |
| Category | [functional/non-functional/constraint/assumption] |
| Source Doc | [filename] |
| Line Reference | [line numbers or section] |
| Confidence | [high/medium/low] |

### 2.3 Categorization

Classify each requirement:

**FUNCTIONAL** (observable behavior):
- User-facing features: "User can reset password"
- API endpoints: "POST /api/users creates new user"
- Data operations: "System stores user preferences"

**NON-FUNCTIONAL** (quality attributes):
- Performance: "Response time < 200ms"
- Security: "All data encrypted at rest"
- Scalability: "Support 10K concurrent users"
- Reliability: "99.9% uptime"
- Usability: "Mobile-responsive design"

**CONSTRAINTS** (boundaries):
- Technical: "Must use PostgreSQL"
- Regulatory: "GDPR compliant"
- Architectural: "Microservices pattern"
- Resource: "Max 2GB memory"

**ASSUMPTIONS** (implicit requirements):
- Context: "Email service available"
- Preconditions: "Users authenticated before action"
- Integrations: "Payment gateway configured"

### 2.4 Deduplication

**Timing:** Deduplication occurs AFTER extraction (2.2) and categorization (2.3), before provenance tracking (2.5).

Compare each new requirement against accumulated requirements:

1. **Normalize both requirements:**
   - Remove punctuation, lowercase, remove stop words
   - Compare semantic meaning

2. **If duplicate found:**
   - Link to existing requirement ID
   - Add current document to provenance (multi-source)
   - Do NOT add as new requirement

3. **If NOT duplicate:**
   - Add as new requirement
   - Record provenance

**Note:** Phase 3.1 performs a final deduplication pass across the entire set to catch duplicates that weren't detected during iteration due to format differences.

### 2.5 Provenance Tracking

For every requirement, maintain:

```
provenance[req_id] = {
  primary_source: "filename",
  section: "section name",
  line_ref: "L42-47",
  verbatim_quote: "[exact text]",
  supporting_sources: ["other docs if any"]
}
```

### 2.6 MUST ASK Condition Checking [STOP POINT]

**This is a STOP POINT within iteration. After processing each document, evaluate these conditions.**

**If ANY condition is detected → STOP IMMEDIATELY and output BLOCKED:MUST_ASK**

#### MUST ASK Checklist

After extracting requirements from each document, evaluate:

| # | Condition | Question | Answer | Evidence |
|---|-----------|----------|--------|----------|
| **MA-1** | **Contradictory Requirements** | Do any extracted requirements logically contradict requirements from previous documents? | YES/NO | [quote both] |
| **MA-2** | **Critical Ambiguity** | Are there requirements using undefined terms that could lead to wrong implementation? | YES/NO | [quote + options] |
| **MA-3** | **Scope Conflict** | Do documents describe different projects or mutually exclusive features? | YES/NO | [evidence] |
| **MA-4** | **Priority Conflict** | Do competing requirements exist without guidance on which wins? | YES/NO | [evidence] |
| **MA-5** | **Incomplete Requirements** | Are there requirements lacking sufficient detail for implementation? | YES/NO | [what's missing] |

#### Examples of Each Condition

**MA-1 Contradictory Requirements:**
- Doc A: "System must support offline-first sync"
- Doc B: "System must always require real-time connection"

**MA-2 Critical Ambiguity:**
- "System must be secure" (what does "secure" mean?)
- "Must integrate with the system" (which system?)

**MA-3 Scope Conflict:**
- Doc A describes "Customer Portal"
- Doc B describes "Admin Dashboard"
- No guidance on whether these are the same project

**MA-4 Priority Conflict:**
- Requirement A needs fast response (< 100ms)
- Requirement B needs comprehensive logging (adds latency)
- No guidance on which wins

**MA-5 Incomplete Requirements:**
- "System must support mobile" (what devices? OS versions?)
- "API must be scalable" (target load? concurrent users?)

#### MUST ASK Decision

**If ANY of MA-1 through MA-5 is YES:**

You MUST output the following and **STOP IMMEDIATELY**:

```markdown
## BLOCKED

<promise>BLOCKED:MUST_ASK</promise>

### Requirements Conflict Detected

Processing cannot continue without resolving the following issues.

### Document Being Processed
[Current document name and path]

### MUST ASK Condition(s) Triggered

| # | Condition | Evidence |
|---|-----------|----------|
| MA-[N] | [condition type] | [specific quote/evidence] |

### Conflicting Requirements

#### Conflict: [Title]
**Requirement A** (from [doc1]:[line]):
> "[quote]"

**Requirement B** (from [doc2]:[line]):
> "[quote]"

**Why This Blocks:** [explanation of why this cannot be resolved automatically]

### Progress So Far
- Documents processed: [N/M]
- Requirements extracted: [N]
- Document queue remaining: [list]

### Decision Options
1. [Option A with rationale]
2. [Option B with rationale]
3. [Suggested default if reasonable]

### To Unblock
Provide resolution, then re-run:
`/research-to-requirements $1 --resolve "[decision]"`
```

**DO NOT continue processing remaining documents when MUST ASK fires.**

---

**If ALL of MA-1 through MA-5 are NO:**

Document the completed check and continue to next document:

```markdown
#### MUST ASK Check: PASSED (Document [N/M])
All conditions evaluated NO. Proceeding to next document.
```

### 2.7 Update Progress

After each document:

1. **Mark document as PROCESSED** in queue
2. **Update TodoWrite** with progress
3. **Log extraction summary:**

```
Document [N/M] Processed: [filename]
├── Requirements Extracted: [N]
│   ├── Functional: [N]
│   ├── Non-Functional: [N]
│   ├── Constraints: [N]
│   └── Assumptions: [N]
├── Duplicates Found: [N]
├── Conflicts Flagged: [N]
└── Running Total: [N] requirements
```

### 2.8 Iteration Exit Check

After each document, evaluate exit conditions in this order:

**1. MUST ASK Check (Section 2.6):**
- If ANY MA-1 through MA-5 is YES → **STOP IMMEDIATELY** with BLOCKED:MUST_ASK
- Do NOT continue to remaining documents

**2. STUCK Check:**
- If stuck counter >= 3 → Output STUCK and STOP

**3. Continue Check:**
- If MUST ASK passed AND more documents in queue → Continue to next document
- If MUST ASK passed AND all documents processed → Proceed to Phase 3: Finalize

**Iteration Flow:**
```
FOR EACH document:
  2.1 Read document
  2.2 Extract requirements
  2.3 Categorize
  2.4 Deduplicate
  2.5 Track provenance
  2.6 MUST ASK Gate ──► If ANY YES → STOP with BLOCKED:MUST_ASK
  2.7 Update progress
  2.8 Exit check ──► If more docs → LOOP BACK to 2.1
                 └──► If done → Phase 3
```

---

## Phase 3: Finalize

### 3.1 Consolidate Requirements

1. **Final deduplication pass** across entire set
2. **Assign sequential IDs** (FR-001, NFR-001, CON-001, ASM-001)
3. **Infer priority** from frequency of mention and source authority:
   - Spec documents > meeting notes > feedback
   - Multiple sources = higher confidence

### 3.2 Generate Traceability Matrix

Create mapping from each requirement to source:

| Req ID | Requirement | Source Doc | Section | Line | Category |
|--------|-------------|------------|---------|------|----------|
| FR-001 | [text] | [doc] | [section] | [line] | Functional |
| NFR-001 | [text] | [doc] | [section] | [line] | Non-Functional |
| ... | ... | ... | ... | ... | ... |

### 3.3 Final Validation

**Note:** If you reached Phase 3, all MUST ASK checks passed during iteration. No blocking conflicts exist.

**Final validation checklist:**

| Check | Status |
|-------|--------|
| All documents processed | [ ] |
| No MUST ASK conditions triggered | [ ] |
| All requirements have provenance | [ ] |
| No duplicate IDs | [ ] |
| Traceability matrix complete | [ ] |

**If all checks pass → Proceed to generate output document**

### 3.4 Generate Output Document

Create a structured requirements document with all sections (see Output Format below).

---

## Stuck Detection

The stuck counter is **global** (per command run), not per-document.

**Increment stuck counter when:**
- Same document fails to parse (each failure = +1)
- Same extraction error occurs on the same document
- Document timeout (> 5 min processing)

**Reset stuck counter when:**
- Successfully process a different document
- Different error encountered (shows troubleshooting progress)
- Extract new unique requirements from any document

**Threshold: 3 consecutive identical failures → Output STUCK**

**Example:**
```
Doc A fails (stuck=1) → Doc B succeeds → stuck resets to 0
Doc A fails (stuck=1) → Doc A fails same error (stuck=2) → Doc A fails same error (stuck=3) → STUCK
Doc A fails (stuck=1) → Doc A fails different error → stuck resets to 1 (new error type)
```

---

## Exit Conditions

### REQUIREMENTS_COMPLETE

When: All documents processed, requirements synthesized, no blocking conflicts

```markdown
## COMPLETE

<promise>REQUIREMENTS_COMPLETE</promise>

### Summary
Processed [N] documents and synthesized [N] requirements.

### Requirements Extracted
| Category | Count |
|----------|-------|
| Functional | [N] |
| Non-Functional | [N] |
| Constraints | [N] |
| Assumptions | [N] |
| **Total** | **[N]** |

### Documents Processed
| # | Document | Requirements | Status |
|---|----------|--------------|--------|
| 1 | [filename] | [N] | PROCESSED |
| ... | ... | ... | ... |

### Output Generated
[Path to requirements document]

### Next Steps
1. Review requirements document
2. Address any open questions
3. Run `/plan-epic` to create implementation plan
```

### BLOCKED:MUST_ASK

When: Any MUST ASK condition (MA-1 through MA-5) evaluates to YES during document processing.

**This exit is triggered IMMEDIATELY when a condition is detected. Processing stops mid-iteration.**

Output format is defined in Section 2.6 above. Key elements:

```markdown
## BLOCKED

<promise>BLOCKED:MUST_ASK</promise>

### Requirements Conflict Detected
Processing cannot continue without resolving the following issues.

### Document Being Processed
[The document that triggered the MUST ASK condition]

### MUST ASK Condition(s) Triggered
| # | Condition | Evidence |
|---|-----------|----------|
| MA-[N] | [condition type] | [specific evidence] |

### Conflicting Requirements
[Detailed quotes and explanation]

### Progress So Far
- Documents processed: [N/M]
- Requirements extracted: [N]
- Document queue remaining: [list of unprocessed docs]

### Decision Options
[Numbered options for resolution]

### To Unblock
Provide resolution, then re-run:
`/research-to-requirements $1 --resolve "[decision]"`
```

**Important:** Unlike deferred conflict assessment, this exit occurs AS SOON as a conflict is detected, not at the end of processing.

### BLOCKED:RUNTIME

When: Folder empty, no readable documents, output path not writable

```markdown
## BLOCKED

<promise>BLOCKED:RUNTIME</promise>

### Runtime Error
[Specific error description]

### Attempted
[What was tried]

### Required to Unblock
[Specific action needed]
```

### STUCK

When: Same document fails to parse 3 times consecutively

```markdown
## STUCK

<promise>STUCK</promise>

### Stuck Pattern
Failed to process document [N] times consecutively.

### Recent Attempts
| Attempt | Document | Error |
|---------|----------|-------|
| 1 | [filename] | [error] |
| 2 | [filename] | [error] |
| 3 | [filename] | [error] |

### Progress Before Stuck
- Documents processed: [N/M]
- Requirements extracted: [N]

### Alternatives
1. Remove problematic document and retry
2. Convert document to different format
3. Manually extract requirements from failed document

### To Resume
Fix the issue and re-run: `/research-to-requirements $1`
```

---

## Output Document Format

The final requirements document should follow this structure:

```markdown
# Consolidated Requirements Document

**Generated:** [timestamp]
**Source Folder:** [path]
**Documents Processed:** [N]

---

## Executive Summary

[2-3 sentences: what was analyzed, key findings, total requirements]

### Quick Stats
| Metric | Value |
|--------|-------|
| Source Documents | [N] |
| Total Requirements | [N] |
| Functional Requirements | [N] |
| Non-Functional Requirements | [N] |
| Constraints | [N] |
| Assumptions | [N] |
| Conflicts Identified | [N] |
| Open Questions | [N] |

---

## Functional Requirements

| ID | Requirement | Priority | Source | Line Ref |
|----|-------------|----------|--------|----------|
| FR-001 | [requirement text] | High/Med/Low | [doc] | [line] |
| FR-002 | [requirement text] | High/Med/Low | [doc] | [line] |
| ... | ... | ... | ... | ... |

---

## Non-Functional Requirements

### Performance
| ID | Requirement | Target | Source |
|----|-------------|--------|--------|
| NFR-P001 | [requirement] | [metric] | [doc] |

### Security
| ID | Requirement | Source |
|----|-------------|--------|
| NFR-S001 | [requirement] | [doc] |

### Scalability
| ID | Requirement | Target | Source |
|----|-------------|--------|--------|
| NFR-SC001 | [requirement] | [metric] | [doc] |

### Other Quality Attributes
| ID | Type | Requirement | Source |
|----|------|-------------|--------|
| NFR-001 | [type] | [requirement] | [doc] |

---

## Constraints and Assumptions

### Constraints
| ID | Type | Constraint | Source |
|----|------|-----------|--------|
| CON-001 | Technical | [constraint] | [doc] |
| CON-002 | Regulatory | [constraint] | [doc] |
| CON-003 | Architectural | [constraint] | [doc] |

### Assumptions
| ID | Assumption | Risk if Wrong | Source |
|----|-----------|---------------|--------|
| ASM-001 | [assumption] | [impact] | [doc] |

---

## Open Questions Requiring Stakeholder Input

| # | Question | Context | Impact | Suggested Default |
|---|----------|---------|--------|-------------------|
| 1 | [question] | [why unclear] | [what depends on it] | [suggestion] |

---

## Conflicts/Ambiguities Table

| # | Type | Description | Sources | Resolution |
|---|------|-------------|---------|------------|
| 1 | Contradiction | [desc] | [docs] | [how resolved or "OPEN"] |
| 2 | Ambiguity | [desc] | [docs] | [assumption made or "OPEN"] |

---

## Traceability Matrix

| Requirement | Source Document | Section | Line Ref | Confidence |
|-------------|-----------------|---------|----------|------------|
| FR-001 | [doc1] | [section] | [lines] | High |
| FR-001 | [doc2] | [section] | [lines] | High |
| FR-002 | [doc1] | [section] | [lines] | Medium |
| ... | ... | ... | ... | ... |

---

## Appendix: Source Documents

| # | Document | Format | Requirements | Notes |
|---|----------|--------|--------------|-------|
| 1 | [filename] | [type] | [count] | [any issues] |
| 2 | [filename] | [type] | [count] | [any issues] |

---

## Processing Notes

- **Extraction Method:** Automated keyword + structural analysis
- **Deduplication:** Semantic similarity matching
- **Confidence Levels:**
  - High: Explicit requirement statement
  - Medium: Inferred from context
  - Low: Ambiguous, flagged for review
```

---

## Begin

1. Create progress tracking with TodoWrite for all phases
2. Start Phase 1: Validate and scan **$1**
3. **Phase 1 Gate: GO/NO-GO decision**
   - If folder validation fails → Output BLOCKED:RUNTIME and STOP
   - If validation passes → Continue to Phase 2
4. Execute Phase 2: Process each document in the ralph-loop
5. **After EACH document: Evaluate MUST ASK Gate (Section 2.6)**
   - Fill out the MUST ASK checklist (MA-1 through MA-5)
   - If ANY condition is YES → Output BLOCKED:MUST_ASK and **STOP IMMEDIATELY**
   - If ALL conditions are NO → Continue to next document or Phase 3
6. **Only proceed to Phase 3 if ALL documents passed MUST ASK checks**
7. Execute Phase 3: Synthesize and generate output document
8. Output REQUIREMENTS_COMPLETE

**Critical Rule:** When a MUST ASK condition fires, you MUST stop immediately. Do NOT:
- Continue processing remaining documents
- Try to work around the conflict
- Defer the decision to later

---

## Reference

This command follows the Ralph Wiggum pattern.
See: @.claude/patterns/ralph-wiggum.md
