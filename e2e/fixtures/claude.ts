import { resolve } from "node:path";
import { test as base } from "vitest";
import { ClaudeRunner } from "../lib/claude-runner.js";
import { TestFactory } from "../lib/factory.js";

const MCP_CONFIG_PATH = resolve(
  import.meta.dirname,
  "..",
  ".mcp-config.tmp.json",
);
const PROJECT_DIR = resolve(import.meta.dirname, "..", "..");

export const test = base.extend<{
  claude: ClaudeRunner;
  factory: TestFactory;
}>({
  claude: async ({ task }, use) => {
    const runner = new ClaudeRunner({
      mcpConfigPath: MCP_CONFIG_PATH,
      projectDir: PROJECT_DIR,
      maxBudgetUsd: "0.30",
    });
    await use(runner);
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

export { expect, describe } from "vitest";
