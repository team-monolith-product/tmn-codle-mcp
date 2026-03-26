import { spawn } from "node:child_process";
import { dirname } from "node:path";
import { parseNdjson, type ClaudeResult, type UsageStats } from "./ndjson.js";

interface ClaudeRunnerOptions {
  accessToken: string;
  codleBin: string;
  projectDir: string;
  maxBudgetUsd: string;
}

export class ClaudeRunner {
  private accessToken: string;
  private codleBin: string;
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
    this.accessToken = opts.accessToken;
    this.codleBin = opts.codleBin;
    this.projectDir = opts.projectDir;
    this.maxBudgetUsd = opts.maxBudgetUsd;
  }

  async run(
    prompt: string,
    opts?: { timeout?: number },
  ): Promise<ClaudeResult> {
    const timeout = opts?.timeout ?? 120_000;
    const codleBinDir = dirname(this.codleBin);

    // AIDEV-NOTE: CLI의 존재만 알려준다. 플래그 등 상세는 AI가 --help로 탐색.
    // MCP에서 tool schema가 자동 제공되듯, CLI에서는 --help가 그 역할을 한다.
    const systemPrompt =
      `You have the "codle" CLI. CODLE_TOKEN is already set. Output is JSON. ` +
      `Do not explore the codebase.`;

    const fullPrompt = `${systemPrompt}\n\n${prompt}`;

    return new Promise<ClaudeResult>((resolve, reject) => {
      const child = spawn(
        "claude",
        [
          "-p",
          fullPrompt,
          "--output-format",
          "stream-json",
          "--verbose",
          "--allowed-tools",
          "Bash",
          "--max-budget-usd",
          this.maxBudgetUsd,
          "--no-session-persistence",
          "--model",
          process.env.E2E_MODEL || "sonnet",
        ],
        {
          cwd: this.projectDir,
          env: {
            ...process.env,
            CLAUDECODE: undefined,
            CODLE_TOKEN: this.accessToken,
            PATH: `${codleBinDir}:${process.env.PATH ?? ""}`,
          },
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
