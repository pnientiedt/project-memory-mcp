import { simpleGit } from "simple-git";

/**
 * Stage and commit all modified .project-memory/*.md files.
 *
 * Uses `git rev-parse --show-toplevel` to resolve the actual repo root
 * regardless of process.cwd() (which may differ when spawned via stdio).
 * Errors are logged to stderr and re-thrown so callers can decide handling.
 */
export async function autoCommitMemory(skipKeyword: string, repoRoot?: string): Promise<void> {
  const startGit = simpleGit(repoRoot ?? process.cwd());

  // Resolve actual git root — handles cwd drift when spawned by Claude Code
  let root: string;
  try {
    root = (await startGit.revparse(["--show-toplevel"])).trim();
  } catch (err) {
    process.stderr.write(`[project-memory] autoCommitMemory: not a git repo (cwd=${process.cwd()}): ${String(err)}\n`);
    throw err;
  }

  const git = simpleGit(root);
  const status = await git.status();
  const memoryFiles = status.files
    .map((f) => f.path)
    .filter((p) => p.startsWith(".project-memory/") && p.endsWith(".md"));

  if (memoryFiles.length === 0) return;

  try {
    await git.add(memoryFiles);
    await git.commit(`chore: update project memory ${skipKeyword}`, memoryFiles, {
      "--no-verify": null,
    });
    process.stderr.write(`[project-memory] auto-committed memory: ${memoryFiles.join(", ")}\n`);
  } catch (err) {
    process.stderr.write(`[project-memory] autoCommitMemory failed: ${String(err)}\n`);
    throw err;
  }
}
