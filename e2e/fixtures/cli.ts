import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { describe as _describe, expect, test as base } from "vitest";
import { CliRunner } from "../lib/cli-runner.js";
import { TestFactory } from "../lib/factory.js";
import { writeTestLog } from "../lib/log-writer.js";

const CONFIG_PATH = resolve(
  import.meta.dirname,
  "..",
  ".mcp-config.tmp.json",
);
const PROJECT_DIR = resolve(import.meta.dirname, "..", "..");

function readAccessToken(): string {
  const config = JSON.parse(readFileSync(CONFIG_PATH, "utf-8")) as {
    e2e: { accessToken: string };
  };
  return config.e2e.accessToken;
}

const E2E_REPEATS = Math.max(0, parseInt(process.env.E2E_REPEATS || "1") - 1);

export const test = base.extend<{
  cli: CliRunner;
  factory: TestFactory;
}>({
  cli: async ({ task }, use) => {
    const runner = new CliRunner({
      projectDir: PROJECT_DIR,
      accessToken: readAccessToken(),
      maxBudgetUsd: "0.30",
    });
    await use(runner);

    if (runner.lastResult) {
      writeTestLog(task.name, runner.lastPrompt, runner.lastResult);
    }

    task.meta.runCount = ((task.meta.runCount as number) ?? 0) + 1;
    task.meta.costUsd =
      ((task.meta.costUsd as number) ?? 0) + runner.lastCostUsd;
    task.meta.durationMs =
      ((task.meta.durationMs as number) ?? 0) + runner.lastDurationMs;
    task.meta.numTurns = runner.lastNumTurns;
    task.meta.toolCallCount = runner.lastToolCallCount;
    task.meta.inputTokens =
      ((task.meta.inputTokens as number) ?? 0) + runner.lastUsage.inputTokens;
    task.meta.outputTokens =
      ((task.meta.outputTokens as number) ?? 0) +
      runner.lastUsage.outputTokens;
  },
  factory: async ({}, use) => {
    await use(new TestFactory());
  },
});

export const describe: typeof _describe =
  E2E_REPEATS > 0
    ? (Object.assign((name: string, ...args: any[]) => {
        if (typeof args[0] === "function") {
          return (_describe as any)(name, { repeats: E2E_REPEATS }, args[0]);
        }
        return (_describe as any)(
          name,
          { repeats: E2E_REPEATS, ...args[0] },
          args[1],
        );
      }, _describe) as typeof _describe)
    : _describe;

export { expect };
