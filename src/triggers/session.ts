import type { FileService } from "../services/file.js";
import type { SessionConfig } from "../types.js";
import { autoCommitMemory } from "../services/memory-commit.js";

interface ToolCall {
  tool: string;
  timestamp: number;
}

export class SessionManager {
  private config: SessionConfig;
  private fileService: FileService;
  private skipKeyword: string;
  private sessionStart: Date;
  private lastActivity: Date;
  private toolCalls: ToolCall[] = [];
  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  private changedFiles = new Set<string>();
  private decisions: string[] = [];
  private sessionEnded = false;

  constructor(config: SessionConfig, fileService: FileService, skipKeyword = "[skip-memory]") {
    this.config = config;
    this.fileService = fileService;
    this.skipKeyword = skipKeyword;
    this.sessionStart = new Date();
    this.lastActivity = new Date();
    this.resetTimer();
  }

  /**
   * Record a tool call — resets inactivity timer.
   */
  recordActivity(toolName: string, changedFile?: string, decision?: string): void {
    this.lastActivity = new Date();
    this.toolCalls.push({ tool: toolName, timestamp: Date.now() });

    if (changedFile) this.changedFiles.add(changedFile);
    if (decision) this.decisions.push(decision);

    this.resetTimer();
  }

  private resetTimer(): void {
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);

    if (!this.config.summarize_on_end) return;

    this.inactivityTimer = setTimeout(
      () => this.onSessionEnd(),
      this.config.inactivity_timeout_minutes * 60 * 1000,
    );
  }

  /**
   * Generate and write session summary when session ends (F-51, F-52).
   */
  private onSessionEnd(): void {
    if (this.sessionEnded) return; // guard against timer/close() race
    if (this.toolCalls.length === 0) return; // skip probe-only sessions
    this.sessionEnded = true;

    const now = new Date();
    const durationMs = now.getTime() - this.sessionStart.getTime();
    const durationMin = Math.round(durationMs / 60000);

    const summary = this.buildSummary(now, durationMin);
    this.fileService.append("progress", summary);
    autoCommitMemory(this.skipKeyword).catch((err: unknown) => {
      process.stderr.write(`[project-memory] session auto-commit failed: ${String(err)}\n`);
    });
  }

  private buildSummary(endTime: Date, durationMin: number): string {
    const date = endTime.toISOString().slice(0, 10);
    const lines = [
      `## 📋 Session Summary — ${date}`,
      ``,
      `**Date:** ${endTime.toISOString()}`,
      `**Duration:** ${durationMin} minutes`,
      `**Tool calls:** ${this.toolCalls.length}`,
    ];

    if (this.changedFiles.size > 0) {
      lines.push(`**Changed files:** ${[...this.changedFiles].join(", ")}`);
    }

    if (this.decisions.length > 0) {
      lines.push(`**Decisions:** ${this.decisions.join("; ")}`);
    }

    const tools = [...new Set(this.toolCalls.map(c => c.tool))];
    if (tools.length > 0) {
      lines.push(`**Tools used:** ${tools.join(", ")}`);
    }

    return lines.join("\n");
  }

  /**
   * Force session end (e.g. on SIGTERM).
   */
  close(): void {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
    if (this.config.summarize_on_end) {
      this.onSessionEnd();
    }
  }
}
