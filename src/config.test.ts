import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// Import after setting up env
async function importLoadConfig() {
  const { loadConfig } = await import("./config.js");
  return loadConfig;
}

describe("config.ts", () => {
  let tmpDir: string;
  let origEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `test-config-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    origEnv = { ...process.env };
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    process.env = origEnv;
  });

  it("returns defaults when no config file exists", async () => {
    const loadConfig = await importLoadConfig();
    const config = loadConfig(join(tmpDir, "nonexistent.yaml"));
    expect(config.ollama.base_url).toBe("http://localhost:11434");
    expect(config.ollama.model).toBe("llama3.2");
    expect(config.ollama.timeout_seconds).toBe(60);
    expect(config.git.hook_port).toBe(47832);
    expect(config.memory.base_dir).toBe(".project-memory");
  });

  it("applies PMM_OLLAMA_URL env override", async () => {
    process.env.PMM_OLLAMA_URL = "http://192.168.1.10:11434";
    const loadConfig = await importLoadConfig();
    const config = loadConfig(join(tmpDir, "nonexistent.yaml"));
    expect(config.ollama.base_url).toBe("http://192.168.1.10:11434");
    delete process.env.PMM_OLLAMA_URL;
  });

  it("applies PMM_OLLAMA_MODEL env override", async () => {
    process.env.PMM_OLLAMA_MODEL = "mistral";
    const loadConfig = await importLoadConfig();
    const config = loadConfig(join(tmpDir, "nonexistent.yaml"));
    expect(config.ollama.model).toBe("mistral");
    delete process.env.PMM_OLLAMA_MODEL;
  });

  it("applies PMM_HOOK_PORT env override", async () => {
    process.env.PMM_HOOK_PORT = "48000";
    const loadConfig = await importLoadConfig();
    const config = loadConfig(join(tmpDir, "nonexistent.yaml"));
    expect(config.git.hook_port).toBe(48000);
    delete process.env.PMM_HOOK_PORT;
  });

  it("applies PMM_LOG_LEVEL env override", async () => {
    process.env.PMM_LOG_LEVEL = "debug";
    const loadConfig = await importLoadConfig();
    const config = loadConfig(join(tmpDir, "nonexistent.yaml"));
    expect(config.logging.level).toBe("debug");
    delete process.env.PMM_LOG_LEVEL;
  });

  it("does not throw on missing config file — uses defaults", async () => {
    const loadConfig = await importLoadConfig();
    expect(() => loadConfig(join(tmpDir, "missing.yaml"))).not.toThrow();
  });

  it("does not throw on empty config file — uses defaults", async () => {
    const configPath = join(tmpDir, "config.yaml");
    writeFileSync(configPath, "");
    const loadConfig = await importLoadConfig();
    expect(() => loadConfig(configPath)).not.toThrow();
  });
});
