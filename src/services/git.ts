import { simpleGit } from "simple-git";

export interface GitDiffResult {
  message: string;
  diff: string;
  changedFiles: string[];
  timestamp: number;
}

/**
 * Extract diff and changed files from the last commit.
 */
export async function getLastCommitDiff(repoPath = "."): Promise<GitDiffResult> {
  const git = simpleGit(repoPath);

  const log = await git.log({ maxCount: 1 });
  const message = log.latest?.message ?? "";

  let diff = "";
  try {
    diff = await git.diff(["HEAD~1", "HEAD", "--stat"]);
  } catch {
    // First commit — no HEAD~1
    diff = await git.diff(["--cached", "--stat"]).catch(() => "");
  }

  let changedFiles: string[] = [];
  try {
    const diffNames = await git.diff(["HEAD~1", "HEAD", "--name-only"]);
    changedFiles = diffNames.split("\n").filter(Boolean);
  } catch {
    changedFiles = [];
  }

  return {
    message,
    diff,
    changedFiles,
    timestamp: Math.floor(Date.now() / 1000),
  };
}
