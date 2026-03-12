import type { OllamaService } from "./ollama.js";
import type { MemoryScope } from "../types.js";

const PROMPTS: Record<MemoryScope, string> = {
  decisions: `Du bist ein technischer Architekt. Analysiere den folgenden Git-Commit-Diff und extrahiere Architekturentscheidungen im ADR-Format.

Ausgabe-Format (Markdown):
## [Kurztitel der Entscheidung]

**Status:** accepted
**Kontext:** [Problem / Ausgangssituation]
**Entscheidung:** [Was wurde entschieden]
**Konsequenzen:** [Trade-offs und Auswirkungen]

Wenn keine Architekturentscheidung erkennbar, antworte mit: KEIN ADR ERKENNBAR

Diff:`,

  tech_debt: `Du bist ein Senior Engineer. Analysiere den folgenden Git-Commit-Diff auf technische Schulden, TODOs, bekannte Probleme oder Workarounds.

Ausgabe-Format (Markdown):
## Tech Debt [SEVERITY]

[Beschreibung der technischen Schuld]

**Betroffene Dateien:** [Dateien]

Schweregrade: LOW | MEDIUM | HIGH | CRITICAL
Wenn keine technische Schuld erkennbar, antworte mit: KEIN TECH DEBT ERKENNBAR

Diff:`,

  progress: `Du bist ein Projektmanager. Fasse den folgenden Git-Commit als Projektfortschritts-Update zusammen.

Ausgabe-Format (Markdown):
## ✅ [Meilensteinname]

**Status:** done
[Kurze Beschreibung was erreicht wurde]

Diff und Commit-Message:`,

  context: `Du bist ein technischer Dokumentar. Extrahiere relevantes Domain-Wissen, Konventionen oder Kontext aus dem folgenden Inhalt.

Ausgabe-Format (Markdown):
## [Kategorie]

[Extrahiertes Wissen als klarer, wiederverwendbarer Text]

Inhalt:`,
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
  const fullText = `Commit-Message: ${commitMessage}\n\n${diff}`;

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
    if (!decisionSummary.includes("KEIN ADR ERKENNBAR")) {
      results.decisions = decisionSummary;
    }
  }

  // Check for tech debt
  if (/TODO|FIXME|HACK|XXX|debt|workaround|temporary/i.test(diff)) {
    const debtSummary = await summarizeForScope(ollamaService, fullText, "tech_debt");
    if (!debtSummary.includes("KEIN TECH DEBT ERKENNBAR")) {
      results.tech_debt = debtSummary;
    }
  }

  return results;
}
