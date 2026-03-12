import { simpleGit } from "simple-git";

/**
 * Stage and commit all modified .project-memory/*.md files.
 * Uses skipKeyword in the message to prevent the post-commit hook from re-triggering.
 */
export async function autoCommitMemory(skipKeyword: string): Promise<void> {
  const git = simpleGit(".");
  const status = await git.status();
  const memoryFiles = status.files
    .map((f) => f.path)
    .filter((p) => p.startsWith(".project-memory/") && p.endsWith(".md"));

  if (memoryFiles.length === 0) return;

  await git.add(memoryFiles);
  await git.commit(`chore: update project memory ${skipKeyword}`, memoryFiles, {
    "--no-verify": null,
  });
}
