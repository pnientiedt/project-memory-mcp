import { readFileSync, existsSync } from "fs";
import { z } from "zod";
import type { ServerConfig } from "./types.js";

const OllamaConfigSchema = z.object({
  base_url: z.string().url().default("http://localhost:11434"),
  model: z.string().default("llama3.2"),
  timeout_seconds: z.number().int().positive().default(60),
  fallback_to_keywords: z.boolean().default(true),
});

const EmbeddingConfigSchema = z.object({
  model: z.string().default("Xenova/all-MiniLM-L6-v2"),
  db_path: z.string().default(".project-memory/embeddings.db"),
});

const GitConfigSchema = z.object({
  hook_enabled: z.boolean().default(true),
  hook_port: z.number().int().min(1024).max(65535).default(47832),
  skip_keyword: z.string().default("[skip-memory]"),
  summarize_diffs: z.boolean().default(true),
});

const WatcherConfigSchema = z.object({
  enabled: z.boolean().default(true),
  paths: z.array(z.string()).default(["CLAUDE.md", "docs/adr/", "README.md"]),
  debounce_ms: z.number().int().positive().default(2000),
});

const SessionConfigSchema = z.object({
  inactivity_timeout_minutes: z.number().int().positive().default(30),
  summarize_on_end: z.boolean().default(true),
});

const LoggingConfigSchema = z.object({
  level: z.enum(["debug", "info", "warn", "error"]).default("info"),
  file: z.string().default(".project-memory/server.log"),
  max_size_mb: z.number().int().positive().default(10),
});

const MemoryFilesConfigSchema = z.object({
  base_dir: z.string().default(".project-memory"),
  files: z.object({
    decisions: z.string().default("decisions.md"),
    tech_debt: z.string().default("tech_debt.md"),
    progress: z.string().default("progress.md"),
    context: z.string().default("context.md"),
  }).default({}),
});

const ServerConfigSchema = z.object({
  ollama: OllamaConfigSchema.default({}),
  embeddings: EmbeddingConfigSchema.default({}),
  git: GitConfigSchema.default({}),
  watcher: WatcherConfigSchema.default({}),
  session: SessionConfigSchema.default({}),
  logging: LoggingConfigSchema.default({}),
  memory: MemoryFilesConfigSchema.default({}),
});

function applyEnvOverrides(raw: Record<string, unknown>): Record<string, unknown> {
  const result = structuredClone(raw) as Record<string, Record<string, unknown>>;

  if (process.env.PMM_OLLAMA_URL) {
    result.ollama = result.ollama ?? {};
    result.ollama.base_url = process.env.PMM_OLLAMA_URL;
  }
  if (process.env.PMM_OLLAMA_MODEL) {
    result.ollama = result.ollama ?? {};
    result.ollama.model = process.env.PMM_OLLAMA_MODEL;
  }
  if (process.env.PMM_HOOK_PORT) {
    result.git = result.git ?? {};
    result.git.hook_port = parseInt(process.env.PMM_HOOK_PORT, 10);
  }
  if (process.env.PMM_LOG_LEVEL) {
    result.logging = result.logging ?? {};
    result.logging.level = process.env.PMM_LOG_LEVEL;
  }

  return result;
}

export function loadConfig(configPath = ".project-memory/config.yaml"): ServerConfig {
  let rawConfig: Record<string, unknown> = {};

  if (existsSync(configPath)) {
    try {
      const content = readFileSync(configPath, "utf-8");
      // Simple YAML parser for our known schema — uses JSON-like structure via zod defaults
      // Full YAML parsing would require a dependency; we parse known keys manually
      rawConfig = parseSimpleYaml(content);
    } catch {
      // Config parse error — use defaults
    }
  }

  rawConfig = applyEnvOverrides(rawConfig);

  const result = ServerConfigSchema.safeParse(rawConfig);
  if (!result.success) {
    throw new Error(`Invalid configuration: ${result.error.message}`);
  }

  return result.data;
}

/**
 * Minimal YAML parser for our config schema.
 * Handles nested key: value pairs and arrays.
 * For production use, replace with a proper YAML library.
 */
function parseSimpleYaml(content: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = content.split("\n");
  let currentSection: string | null = null;
  let currentObj: Record<string, unknown> = {};

  for (const line of lines) {
    // Skip comments and empty lines
    if (line.trim().startsWith("#") || line.trim() === "") continue;

    const indentLevel = line.match(/^(\s*)/)?.[1].length ?? 0;

    if (indentLevel === 0) {
      // Top-level key
      if (currentSection) {
        result[currentSection] = currentObj;
      }
      const match = line.match(/^(\w+):\s*(.*)/);
      if (match) {
        currentSection = match[1];
        currentObj = {};
        if (match[2]) {
          // Inline value at top level
          result[currentSection] = parseValue(match[2]);
          currentSection = null;
        }
      }
    } else if (indentLevel >= 2 && currentSection) {
      // Nested key-value
      const match = line.trim().match(/^(\w+):\s*(.*)/);
      if (match) {
        currentObj[match[1]] = match[2] ? parseValue(match[2]) : {};
      } else if (line.trim().startsWith("- ")) {
        // Array item — simplified: attach to last key
        const val = line.trim().slice(2).replace(/['"]/g, "");
        const lastKey = Object.keys(currentObj).at(-1);
        if (lastKey) {
          if (!Array.isArray(currentObj[lastKey])) {
            currentObj[lastKey] = [];
          }
          (currentObj[lastKey] as string[]).push(val);
        }
      }
    }
  }

  if (currentSection) {
    result[currentSection] = currentObj;
  }

  return result;
}

function parseValue(val: string): unknown {
  const v = val.trim().replace(/['"]/g, "");
  if (v === "true") return true;
  if (v === "false") return false;
  const num = Number(v);
  if (!isNaN(num) && v !== "") return num;
  return v;
}
