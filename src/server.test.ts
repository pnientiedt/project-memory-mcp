import { describe, it, expect, afterEach } from "vitest";
import { rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("createServer()", () => {
  const tmpDirs: string[] = [];

  afterEach(async () => {
    for (const dir of tmpDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    tmpDirs.length = 0;
  });

  it("creates server with default config and initializes .project-memory/", async () => {
    // Override default config path to use a temp dir
    const tmpDir = join(tmpdir(), `test-server-${Date.now()}`);
    tmpDirs.push(tmpDir);

    process.env.PMM_HOOK_PORT = String(47950 + Math.floor(Math.random() * 40));
    process.env.PMM_LOG_LEVEL = "error";

    const { createServer } = await import("./server.js");
    const server = createServer(join(tmpDir, "config.yaml"));

    expect(server.mcp).toBeDefined();
    expect(server.fileService).toBeDefined();
    expect(server.embeddingService).toBeDefined();
    expect(server.ollamaService).toBeDefined();
    expect(server.sessionManager).toBeDefined();
    expect(typeof server.close).toBe("function");

    await server.close();
    delete process.env.PMM_HOOK_PORT;
    delete process.env.PMM_LOG_LEVEL;
  });
});
