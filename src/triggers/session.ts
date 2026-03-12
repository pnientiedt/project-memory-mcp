import type { FileService } from "../services/file.js";
import type { SessionConfig } from "../types.js";

interface ToolCall {
  tool: string;
  timestamp: number;
}

export class SessionManager {
  private config: SessionConfig;
  private fileService: FileService;
  private sessionStart: Date;
  private lastActivity: Date;
  private toolCalls: ToolCall[] = [];
  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  private changedFiles = new Set<string>();
  private decisions: string[] = [];

  constructor(config: SessionConfig, fileService: FileService) {
    this.config = config;
    this.fileService = fileService;
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
    const now = new Date();
    const durationMs = now.getTime() - this.sessionStart.getTime();
    const durationMin = Math.round(durationMs / 60000);

    const summary = this.buildSummary(now, durationMin);
    this.fileService.append("progress", summary);
  }

  private buildSummary(endTime: Date, durationMin: number): string {
    const date = endTime.toISOString().slice(0, 10);
    const lines = [
      `## 📋 Session Summary — ${date}`,
      ``,
      `**Datum:** ${endTime.toISOString()}`,
      `**Dauer:** ${durationMin} Minuten`,
      `**Tool-Calls:** ${this.toolCalls.length}`,
    ];

    if (this.changedFiles.size > 0) {
      lines.push(`**Geänderte Dateien:** ${[...this.changedFiles].join(", ")}`);
    }

    if (this.decisions.length > 0) {
      lines.push(`**Entscheidungen:** ${this.decisions.join("; ")}`);
    }

    const tools = [...new Set(this.toolCalls.map(c => c.tool))];
    if (tools.length > 0) {
      lines.push(`**Verwendete Tools:** ${tools.join(", ")}`);
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
