import type { OllamaService } from "./ollama.js";
import type { MemoryScope } from "../types.js";

const PROMPTS: Record<MemoryScope, string> = {
  decisions: `You are a technical architect. Analyze the following Git commit diff and extract architectural decisions in ADR format.

Output format (Markdown):
## [Short title of the decision]

**Status:** accepted
**Context:** [Problem / background situation]
**Decision:** [What was decided]
**Consequences:** [Trade-offs and impact]

If no architectural decision is apparent, respond with: NO ADR FOUND

Diff:`,

  tech_debt: `You are a senior engineer. Analyze the following Git commit diff for technical debt, TODOs, known issues, or workarounds.

Output format (Markdown):
## Tech Debt [SEVERITY]

[Description of the technical debt]

**Affected Files:** [files]

Severity levels: LOW | MEDIUM | HIGH | CRITICAL
If no technical debt is apparent, respond with: NO TECH DEBT FOUND

Diff:`,

  progress: `You are a project manager. Summarize the following Git commit as a project progress update.

Output format (Markdown):
## ✅ [Milestone name]

**Status:** done
[Brief description of what was accomplished]

Diff and commit message:`,

  context: `You are a technical writer. Extract NEW domain knowledge, architectural conventions, or non-obvious technical context from the following file content that would be useful for a future AI assistant working on this project.

Only extract information that is NOT already obvious from reading the file itself — focus on decisions, constraints, patterns, and conventions that explain WHY things are done a certain way.

Do NOT summarize or restate the file content. Do NOT describe what the file does.

Output format (Markdown):
## [Category]

[Extracted knowledge as clear, reusable text]

If there is no new domain knowledge to extract (e.g. the file is documentation, a README, or contains only already-obvious information), respond with: NO CONTEXT FOUND

Content:`,
};

export async function summarizeForScope(
  ollamaService: OllamaService,
  text: string,
  scope: MemoryScope,
): Promise<string> {
  const prompt = PROMPTS[scope];
  return ollamaService.summarize(text, prompt);
}

export async function summarizeCommit(
  ollamaService: OllamaService,
  diff: string,
  commitMessage: string,
): Promise<Record<MemoryScope, string | null>> {
  const fullText = `Commit message: ${commitMessage}\n\n${diff}`;

  const results: Record<MemoryScope, string | null> = {
    decisions: null,
    tech_debt: null,
    progress: null,
    context: null,
  };

  // Progress is always relevant for commits
  const progressSummary = await summarizeForScope(ollamaService, fullText, "progress");
  results.progress = progressSummary;

  // Check for architectural decisions (heuristic: larger diffs or keywords)
  if (diff.length > 500 || /architect|pattern|design|refactor|interface/i.test(commitMessage)) {
    const decisionSummary = await summarizeForScope(ollamaService, fullText, "decisions");
    if (!decisionSummary.includes("NO ADR FOUND")) {
      results.decisions = decisionSummary;
    }
  }

  // Check for tech debt
  if (/TODO|FIXME|HACK|XXX|debt|workaround|temporary/i.test(diff)) {
    const debtSummary = await summarizeForScope(ollamaService, fullText, "tech_debt");
    if (!debtSummary.includes("NO TECH DEBT FOUND")) {
      results.tech_debt = debtSummary;
    }
  }

  return results;
}
