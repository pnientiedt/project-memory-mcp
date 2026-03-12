export type MemoryScope = "decisions" | "tech_debt" | "progress" | "context";

export interface MemoryEntry {
  id: string;
  source_file: MemoryScope;
  section: string;
  content: string;
  created_at: number;
  updated_at: number;
}

export interface SearchResult {
  id: string;
  source_file: MemoryScope;
  section: string;
  content: string;
  score: number;
}

export interface OllamaConfig {
  base_url: string;
  model: string;
  timeout_seconds: number;
  fallback_to_keywords: boolean;
}

export interface EmbeddingConfig {
  model: string;
  db_path: string;
}

export interface GitConfig {
  hook_enabled: boolean;
  hook_port: number;
  skip_keyword: string;
  summarize_diffs: boolean;
}

export interface WatcherConfig {
  enabled: boolean;
  paths: string[];
  debounce_ms: number;
}

export interface SessionConfig {
  inactivity_timeout_minutes: number;
  summarize_on_end: boolean;
}

export interface LoggingConfig {
  level: "debug" | "info" | "warn" | "error";
  file: string;
  max_size_mb: number;
}

export interface MemoryFilesConfig {
  base_dir: string;
  files: {
    decisions: string;
    tech_debt: string;
    progress: string;
    context: string;
  };
}

export interface ServerConfig {
  ollama: OllamaConfig;
  embeddings: EmbeddingConfig;
  git: GitConfig;
  watcher: WatcherConfig;
  session: SessionConfig;
  logging: LoggingConfig;
  memory: MemoryFilesConfig;
}

export interface GitEvent {
  event: "post-commit";
  message: string;
  diff: string;
  changed_files: string[];
  timestamp: number;
}

export interface ProvisionResult {
  success: boolean;
  message: string;
}
