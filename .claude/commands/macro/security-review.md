---
description: Perform comprehensive security review of codebase using autonomous ralph-loop
argument-hint: <path> [--scope full|api|auth|data|deps] [--compliance owasp|pci|hipaa|soc2]
allowed-tools: Read, Grep, Glob, Bash, Task, TodoWrite
---

# Security Review (Ralph-Loop)

Autonomously performs a comprehensive security review of a codebase or specified directories, identifying vulnerabilities, security anti-patterns, and compliance gaps.

## Execution Modes

**Headless (run overnight, fresh context each iteration):**
```bash
./.claude/scripts/ralph/security-review.sh $ARGUMENTS
```

**Direct (execute in this session):**
Continue below...

---

## Arguments

**Target Path:** $ARGUMENTS

Parse the arguments:
- `$1` = Path to review (required - directory, file, or glob pattern)
- `--scope` = Focus area: `full` (default), `api`, `auth`, `data`, `deps`
- `--compliance` = Framework: `owasp` (default), `pci`, `hipaa`, `soc2`

## Initialization

### 1. Validate Target

!ls -la $1 2>/dev/null || echo "ERROR: Path not found"

If path doesn't exist or is inaccessible:
```
## BLOCKED

<promise>BLOCKED</promise>

### Error
Target path does not exist or is not accessible: $1

### Type
Runtime - path validation failed

### Required
Provide a valid path to review.
```

### 2. Scan Codebase Structure

Identify:
- Technology stack (languages, frameworks)
- Entry points (API routes, CLI handlers, public methods)
- Authentication layer location
- Configuration files
- Secret handling patterns
- Database access patterns

### 3. Determine Scope

Based on `--scope` flag:

| Scope | Primary Domains | Secondary Domains |
|-------|-----------------|-------------------|
| `full` | All 7 domains | N/A |
| `api` | API Security, Auth, Input Validation | Config, Error Handling |
| `auth` | Auth, Error Handling | API Security |
| `data` | Data Protection, Input Validation, Dependencies | Config |
| `deps` | Dependency Security | Config |

### 4. Load Compliance Framework

Based on `--compliance` flag:

| Framework | Focus Areas | Special Requirements |
|-----------|-------------|---------------------|
| `owasp` | OWASP Top 10 (2021) | CWE cross-references |
| `pci` | PCI-DSS Req 2,3,6,8 | Cardholder data focus |
| `hipaa` | PHI handling, audit logs | Encryption mandatory |
| `soc2` | Trust principles | Access controls, monitoring |

## Execution Model

### Iteration Structure

Each iteration reviews ONE security domain:

```
ITERATION {n} - Domain: {domain_name}
├── SCAN: Find relevant code patterns
├── ANALYZE: Check against security rules
├── CLASSIFY: Assign severity (CRITICAL/HIGH/MEDIUM/LOW/INFO)
├── DOCUMENT: Record findings with file:line references
├── EVALUATE: Check for MUST_ASK conditions
└── DECIDE: Continue or exit
```

### Security Domains (Review Order)

**Domain 1: Authentication & Authorization**
- Session management, tokens, RBAC, OAuth
- Credential storage, password policies
- JWT validation, CSRF protection
- Red flags: hardcoded credentials, missing token expiration, auth bypass

**Domain 2: Input Validation & Injection**
- SQL injection, XSS, command injection, path traversal
- Input sanitization, type validation
- Deserialization, XML/XXE parsing
- Red flags: string concatenation in queries, eval() with user input

**Domain 3: Data Protection**
- Encryption at rest/transit, PII handling
- Secrets management, key rotation
- Password hashing algorithms
- Red flags: plaintext secrets, weak hashing (MD5/SHA1), HTTP endpoints

**Domain 4: Dependency Security**
- CVEs, outdated packages, supply chain risks
- Version pinning, transitive dependencies
- Abandoned/unmaintained packages
- Red flags: known vulnerabilities, floating versions, deprecated packages

**Domain 5: API Security**
- Rate limiting, CORS, authentication enforcement
- Input validation on endpoints
- Response filtering, pagination limits
- Red flags: unauthenticated endpoints, CORS `*`, no rate limiting

**Domain 6: Configuration Security**
- Hardcoded secrets, debug modes
- Environment-specific settings
- Security headers (CSP, HSTS, X-Frame-Options)
- Red flags: debug=True in prod, secrets in config files, missing headers

**Domain 7: Error Handling & Logging**
- Information disclosure, sensitive data in logs
- Error recovery, user enumeration
- Stack trace exposure
- Red flags: stack traces to users, passwords in logs, specific error messages

### Cross-Domain Threat Analysis

After completing individual domains, analyze:

**Attack Chains:**
- Identify multi-step attack paths spanning domains
- Example: Input validation failure → SQL injection → Data exfiltration

**Privilege Escalation Paths:**
- Trace how low-privilege access could escalate
- Map trust boundaries and crossing points

**Defense-in-Depth Gaps:**
- Identify single points of failure
- Check for redundant security controls

**Cumulative Risk Assessment:**
- Multiple LOW findings in same area may compound to MEDIUM
- Related findings across domains may indicate systemic issues

## Severity Classification

| Level | Definition | Action |
|-------|------------|--------|
| **CRITICAL** | Exploitable now, data breach risk | MUST_ASK - immediate attention |
| **HIGH** | Exploitable with effort | Document, prioritize remediation |
| **MEDIUM** | Defense-in-depth gap | Document, include in backlog |
| **LOW** | Best practice violation | Document for awareness |
| **INFO** | Observation, no direct risk | Note for completeness |

## MUST_ASK Stop Conditions

**IMMEDIATELY pause and ask when:**

### MA-1: Critical Vulnerability Found
```
[SECURITY REVIEW PAUSED - CRITICAL FINDING]

<promise>MUST_ASK_CRITICAL</promise>

Finding: {vulnerability type}
Location: {file:line}
Severity: CRITICAL
Evidence: {code snippet - secrets REDACTED}

Question: This requires immediate attention. Should I:
(a) Continue review and compile full report
(b) Stop here for immediate remediation
(c) Provide more context about this specific vulnerability

Blocking: Yes - Critical finding requires human decision
```

### MA-2: Ambiguous Security Boundary
```
[SECURITY REVIEW PAUSED - AMBIGUITY]

<promise>MUST_ASK_AMBIGUITY</promise>

Domain: {domain}
Issue: Cannot determine if {code/endpoint} is:
- User input vs trusted data
- Public-facing vs internal-only
- Handling sensitive data (PII/payment/health)

Question: {specific clarifying question}

Blocking: Yes - Cannot accurately assess risk without clarity
```

### MA-3: Missing Security Context
```
[SECURITY REVIEW PAUSED - MISSING CONTEXT]

<promise>MUST_ASK_CONTEXT</promise>

Domain: {domain}
Context Needed: {specific information}
- Authentication implementation not found
- Threat model undocumented
- Secret management strategy unclear

Request: Please provide {specific information} or indicate where to find it.

Blocking: Yes - Review incomplete without this context
```

### MA-4: Architecture Uncertainty
```
[SECURITY REVIEW PAUSED - ARCHITECTURE]

<promise>MUST_ASK_ARCHITECTURE</promise>

Domain: {domain}
Uncertainty: {what's unclear}
Evidence: {conflicting patterns or missing documentation}

Question: {specific architectural question}

Blocking: Yes - Cannot validate security without clarity
```

## Finding Output Format

For each vulnerability discovered:

```
### [{SEVERITY}] {Finding Title}

**ID:** {DOMAIN}-{NNN}
**Domain:** {Security Domain}
**CWE:** CWE-{XXX} - {CWE Title}
**OWASP:** {OWASP Top 10 Category}

**Location:**
- File: `{absolute/path/to/file}`
- Lines: {start}-{end}

**Description:**
{2-3 sentence explanation of the vulnerability}

**Vulnerable Code:**
```{language}
// REDACTED if contains secrets
{code snippet showing the vulnerable pattern}
```

**Impact:**
- Confidentiality: {None|Partial|Complete}
- Integrity: {None|Partial|Complete}
- Availability: {None|Partial|Complete}

**Remediation:**
{Specific fix with code example}

**Verification:**
{How to confirm the fix is correctly implemented}
```

## Exit Conditions

### COMPLETE

When: All in-scope domains reviewed successfully
```
## COMPLETE

<promise>SECURITY_REVIEW_COMPLETE</promise>

### Security Review Summary

**Target:** {path reviewed}
**Scope:** {full|api|auth|data|deps}
**Compliance Framework:** {owasp|pci|hipaa|soc2}

### Severity Distribution
| Level | Count |
|-------|-------|
| CRITICAL | {n} |
| HIGH | {n} |
| MEDIUM | {n} |
| LOW | {n} |
| INFO | {n} |

### Overall Security Posture
{Critical Risk | High Risk | Medium Risk | Acceptable | Exemplary}

### Key Findings (Top 3)
1. {Most critical finding}
2. {Second most critical}
3. {Third most critical}

### Findings by Domain

{All findings organized by domain, using the output format above}

### Positive Security Findings
{Security controls done well}

### Remediation Roadmap

**Phase 1 - Critical (Immediate):**
{List critical findings}

**Phase 2 - High (This Sprint):**
{List high findings}

**Phase 3 - Medium (Next Sprint):**
{List medium findings}

**Phase 4 - Low (Backlog):**
{List low findings}

### Compliance Status
{If --compliance specified, checklist of framework requirements}

### Secrets Scan Results
{Count of potential secrets found - ALL VALUES REDACTED}
{Locations listed for review}

### Recommended Enhancements
{Prioritized security improvements beyond fixing findings}
```

### BLOCKED

When: Cannot proceed without external input (non-MUST_ASK blockers)
```
## BLOCKED

<promise>BLOCKED</promise>

### Blocker
{Specific impediment - e.g., encrypted files, unsupported language}

### Progress So Far
- Domains completed: {list}
- Findings so far: {count by severity}

### Required to Unblock
{What is needed to continue}
```

### STUCK

When: Same analysis pattern fails 3+ times
```
## STUCK

<promise>STUCK</promise>

### Stuck Pattern
{Description of repeated failure}

### Iteration History
- Attempt 1: {what was tried} → {why it failed}
- Attempt 2: {what was tried} → {why it failed}
- Attempt 3: {what was tried} → {why it failed}

### Partial Results
{Any findings discovered before getting stuck}

### Alternatives Not Tried
{Other approaches that might work}
```

### COMPLETE (No Findings)

When: All in-scope domains reviewed and no vulnerabilities found
```
## COMPLETE

<promise>SECURITY_REVIEW_COMPLETE</promise>

### Security Review Summary

**Target:** {path reviewed}
**Scope:** {full|api|auth|data|deps}
**Compliance Framework:** {owasp|pci|hipaa|soc2}
**Result:** No security vulnerabilities found

### Severity Distribution
| Level | Count |
|-------|-------|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 0 |
| LOW | 0 |
| INFO | {n} |

### Overall Security Posture
Exemplary - No vulnerabilities detected

### Domains Reviewed
{List all domains that were analyzed}

### Positive Security Findings
{Security controls and best practices observed}

### Verification Methods Used
- Static analysis patterns applied
- Configuration checks performed
- Dependency manifest reviewed
- Secret detection patterns scanned

### Recommendations
{Optional enhancements for defense-in-depth}
```

## Stuck Detection

Increment stuck counter when:
- Same file analyzed 3+ times without new findings
- Same domain re-entered without prior completion
- Search patterns return identical empty results twice
- Analysis produces no actionable output for 2 consecutive iterations

Reset stuck counter when:
- New vulnerability discovered
- Moving to new domain
- User provides clarification via MUST_ASK response
- New files discovered in scope

**Threshold: 3 iterations** → Exit with STUCK

## Unsupported Content Handling

### Skip and Continue
For these file types, note in report but continue:
- Binary files (executables, images, compiled assets)
- Minified/bundled JavaScript (unless patterns detectable)
- Generated code (note source if identifiable)
- Files > 1MB (note skipped in report)
- Lock files (package-lock.json, yarn.lock) - scan for integrity only

### BLOCKED Conditions
Trigger BLOCKED exit when:
- All source files are encrypted/obfuscated
- No recognizable source code in target path
- Primary language has no security patterns defined
- Required dependency manifests missing and --scope=deps

### Partial Review
When some files are unsupported:
- Continue with supported files
- Document skipped files in report
- Note coverage percentage
- Flag if critical paths may be in skipped files

## Critical Constraints

### MUST DO:
- Provide file:line references for EVERY finding
- Include CWE/OWASP mapping for every vulnerability
- Include verification method for each finding
- Cross-reference related findings across domains
- Provide actionable remediation with code examples

### MUST NOT:
- **NEVER output actual secret values** - redact and show location only
  - Wrong: `API_KEY = "sk-abc123..."`
  - Right: `API_KEY = "[REDACTED]" at config.py:42`
- **NEVER provide executable exploit code** - conceptual only
- **NEVER skip MUST_ASK conditions** - pause for human input
- **NEVER assume security context** - ask when unclear
- **NEVER mark findings as false positive without investigation**

## Progress Tracking

Use TodoWrite to track domain completion:
```
- [ ] Domain 1: Authentication & Authorization
- [ ] Domain 2: Input Validation & Injection
- [ ] Domain 3: Data Protection
- [ ] Domain 4: Dependency Security
- [ ] Domain 5: API Security
- [ ] Domain 6: Configuration Security
- [ ] Domain 7: Error Handling & Logging
- [ ] Cross-domain threat analysis
- [ ] Report generation
```

## Begin

Start the security review:

1. Validate target path exists
2. Scan codebase structure and identify tech stack
3. Parse scope and compliance flags
4. Initialize TodoWrite with domain checklist
5. Begin Domain 1: Authentication & Authorization

If initialization reveals critical gaps (no auth layer found, all code encrypted, unsupported language), immediately trigger appropriate exit condition.
