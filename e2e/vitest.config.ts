import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["e2e/tests/**/*.test.ts"],
    globalSetup: ["e2e/global-setup.ts"],
    testTimeout: 180_000,
    hookTimeout: 60_000,
    fileParallelism: true,
    reporters: ["default", "e2e/lib/stats-reporter.ts"],
    repeats: Math.max(0, parseInt(process.env.E2E_REPEATS || "1") - 1),
  },
});
