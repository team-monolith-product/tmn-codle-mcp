import { resolve } from "node:path";
import { test as base } from "vitest";
import { ClaudeRunner } from "../lib/claude-runner.js";
import { TestFactory } from "../lib/factory.js";

const MCP_CONFIG_PATH = resolve(import.meta.dirname, "..", ".mcp-config.tmp.json");
const PROJECT_DIR = resolve(import.meta.dirname, "..", "..");

export const test = base.extend<{ claude: ClaudeRunner; factory: TestFactory }>({
  claude: async ({}, use) => {
    await use(
      new ClaudeRunner({
        mcpConfigPath: MCP_CONFIG_PATH,
        projectDir: PROJECT_DIR,
        maxBudgetUsd: "0.30",
      }),
    );
  },
  factory: async ({}, use) => {
    await use(new TestFactory());
  },
});

export { expect, describe } from "vitest";
