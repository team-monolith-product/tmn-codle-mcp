import { spawn } from "node:child_process";
import { parseNdjson, type ClaudeResult, type UsageStats } from "./ndjson.js";

interface ClaudeRunnerOptions {
  mcpConfigPath: string;
  projectDir: string;
  maxBudgetUsd: string;
}

export class ClaudeRunner {
  private mcpConfigPath: string;
  private projectDir: string;
  private maxBudgetUsd: string;
  lastCostUsd = 0;
  lastDurationMs = 0;
  lastNumTurns = 0;
  lastToolCallCount = 0;
  lastUsage: UsageStats = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0,
  };

  constructor(opts: ClaudeRunnerOptions) {
    this.mcpConfigPath = opts.mcpConfigPath;
    this.projectDir = opts.projectDir;
    this.maxBudgetUsd = opts.maxBudgetUsd;
  }

  async run(
    prompt: string,
    opts?: { timeout?: number },
  ): Promise<ClaudeResult> {
    const timeout = opts?.timeout ?? 120_000;

    return new Promise<ClaudeResult>((resolve, reject) => {
      const child = spawn(
        "claude",
        [
          "-p",
          prompt,
          "--output-format",
          "stream-json",
          "--verbose",
          "--mcp-config",
          this.mcpConfigPath,
          "--strict-mcp-config",
          "--allowed-tools",
          "mcp__codle__*",
          "--max-budget-usd",
          this.maxBudgetUsd,
          "--no-session-persistence",
          "--model",
          process.env.E2E_MODEL || "sonnet",
        ],
        {
          cwd: this.projectDir,
          env: { ...process.env, CLAUDECODE: undefined },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );

      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];

      child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
      child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

      const timer = setTimeout(() => {
        child.kill("SIGTERM");
        reject(new Error(`Claude timed out after ${timeout}ms`));
      }, timeout);

      child.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });

      child.on("close", (code) => {
        clearTimeout(timer);
        const stdout = Buffer.concat(stdoutChunks).toString("utf-8");
        const stderr = Buffer.concat(stderrChunks).toString("utf-8");
        const result = parseNdjson(stdout, code ?? 1, stderr);
        this.lastCostUsd = result.costUsd;
        this.lastDurationMs = result.durationMs;
        this.lastNumTurns = result.numTurns;
        this.lastToolCallCount = result.toolCalls.length;
        this.lastUsage = result.usage;
        resolve(result);
      });
    });
  }
}
