import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe as _describe, expect, test as base } from "vitest";
import { ClaudeRunner } from "../lib/claude-runner.js";
import { TestFactory } from "../lib/factory.js";

const CONFIG_PATH = resolve(import.meta.dirname, "..", ".e2e-config.tmp.json");
const PROJECT_DIR = resolve(import.meta.dirname, "..", "..");

interface E2EConfig {
  e2e: { userId: string; accessToken: string; codleBin: string };
}

function readConfig(): E2EConfig {
  return JSON.parse(readFileSync(CONFIG_PATH, "utf-8")) as E2EConfig;
}

const E2E_REPEATS = Math.max(0, parseInt(process.env.E2E_REPEATS || "1") - 1);

export const test = base.extend<{
  claude: ClaudeRunner;
  factory: TestFactory;
}>({
  claude: async ({ task }, use) => {
    const errorsBefore = (task.result as any)?.errors?.length ?? 0;

    const config = readConfig();
    const runner = new ClaudeRunner({
      accessToken: config.e2e.accessToken,
      codleBin: config.e2e.codleBin,
      projectDir: PROJECT_DIR,
      maxBudgetUsd: "0.30",
    });
    await use(runner);

    const errorsAfter = (task.result as any)?.errors?.length ?? 0;
    if (errorsAfter === errorsBefore) {
      task.meta.passCount = ((task.meta.passCount as number) ?? 0) + 1;
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
      ((task.meta.outputTokens as number) ?? 0) + runner.lastUsage.outputTokens;
  },
  factory: async ({}, use) => {
    await use(new TestFactory());
  },
});

// AIDEV-NOTE: vitest 3.x config `repeats` does not propagate to individual tests
// (runner uses `options.repeats` without `runner.config.repeats` fallback, unlike
// `retry`). We inject repeats via describe options so child tests inherit them.
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
