# project-memory-mcp

Persistente AI Wissensbasis für Claude via Model Context Protocol — vollständig offline, kein Cloud-API-Key erforderlich.

Speichert Architekturentscheidungen, technische Schulden, Projektfortschritt und Domain-Wissen in versionierten Markdown-Dateien. Claude liest diese Dateien automatisch über MCP Resources und schreibt neue Einträge über MCP Tools.

## Features

- **4 MCP Resources** — Claude liest `memory://decisions`, `memory://tech-debt`, `memory://progress`, `memory://context` automatisch beim Start der Session
- **5 MCP Tools** — `add_decision`, `log_tech_debt`, `update_progress`, `add_context`, `search_memory`, `reindex_memory`
- **Semantische Suche** — Embedding-basierte Suche via `@huggingface/transformers` (all-MiniLM-L6-v2) lokal in SQLite
- **Git-Hook** — Post-Commit Hook sendet Diff + Message an Ollama zur automatischen Zusammenfassung
- **Filesystem-Watcher** — Änderungen an `CLAUDE.md`, `docs/adr/` usw. triggern Memory-Update
- **Session-Zusammenfassung** — Inaktivitäts-Timer schreibt Session-Summary in `progress.md`
- **Ollama-Fallback** — Keyword-Extraktion wenn Ollama nicht verfügbar

## Voraussetzungen

- Node.js >= 20
- [Ollama](https://ollama.ai) (optional, für automatische Summarization)

```bash
ollama pull llama3.2
```

## Installation

```bash
npm install
npm run build
```

MCP Server in Claude Code registrieren (`.mcp.json` bereits vorkonfiguriert):

```json
{
  "mcpServers": {
    "project-memory": {
      "command": "node",
      "args": ["./dist/index.js"]
    }
  }
}
```

Git-Hook installieren:

```bash
node dist/index.js init
```

## Verwendung

Nach dem Start liest Claude die Memory-Dateien automatisch. Neue Einträge werden über Tools geschrieben:

```
add_decision    — Architekturentscheidung (ADR-Format) speichern
log_tech_debt   — Technische Schuld erfassen
update_progress — Meilenstein aktualisieren
add_context     — Domain-Wissen / Konventionen speichern
search_memory   — Semantisch in der Wissensbasis suchen
reindex_memory  — Embedding-Index neu aufbauen
```

## Konfiguration

`.project-memory/config.yaml` (wird beim ersten Start mit Defaults angelegt):

```yaml
ollama:
  base_url: "http://localhost:11434"
  model: "llama3.2"
  timeout_seconds: 60
  fallback_to_keywords: true

embeddings:
  model: "Xenova/all-MiniLM-L6-v2"
  db_path: ".project-memory/embeddings.db"

git:
  hook_enabled: true
  hook_port: 47832
  skip_keyword: "[skip-memory]"

watcher:
  enabled: true
  paths: ["CLAUDE.md", "docs/adr/", "README.md"]
  debounce_ms: 2000

session:
  inactivity_timeout_minutes: 30
  summarize_on_end: true
```

Environment Variables überschreiben Config:

| Variable | Überschreibt |
|----------|-------------|
| `PMM_OLLAMA_URL` | `ollama.base_url` |
| `PMM_OLLAMA_MODEL` | `ollama.model` |
| `PMM_HOOK_PORT` | `git.hook_port` |
| `PMM_LOG_LEVEL` | `logging.level` |

## Memory-Dateien

Liegen in `.project-memory/` und werden im Git versioniert (außer `embeddings.db` und `server.log`):

| Datei | Inhalt |
|-------|--------|
| `decisions.md` | Architekturentscheidungen (ADRs) |
| `tech_debt.md` | Technische Schulden |
| `progress.md` | Projektfortschritt & Session-Summaries |
| `context.md` | Domain-Wissen & Konventionen |

## Entwicklung

```bash
npm test              # Tests ausführen (79 Tests)
npm run test:coverage # Coverage-Report (83% Line Coverage)
npm run build         # TypeScript kompilieren
npm run typecheck     # Nur Typprüfung
```

## Projektstruktur

```
src/
  index.ts              # Einstiegspunkt, stdio Transport
  server.ts             # MCP Server Factory
  config.ts             # Konfiguration laden & validieren (zod)
  types.ts              # Gemeinsame TypeScript-Typen
  resources/
    memory.ts           # MCP Resources (memory://)
  tools/
    write.ts            # add_decision, log_tech_debt, update_progress, add_context
    read.ts             # get_memory, search_memory
    admin.ts            # reindex_memory
  services/
    file.ts             # Atomares Read/Write der Memory-Dateien
    embedding.ts        # transformers.js + cosine similarity
    db.ts               # SQLite Schema (WAL-Mode)
    ollama.ts           # Ollama HTTP Client + Keyword-Fallback
    summarization.ts    # Prompts pro Memory-Kategorie
    git.ts              # simple-git Integration
  triggers/
    git-hook.ts         # HTTP Server für Post-Commit Hook
    watcher.ts          # Filesystem Watcher (chokidar)
    session.ts          # Inaktivitäts-Timer & Session-Summary
hooks/
  post-commit           # Shell-Script für Git Hook
```
