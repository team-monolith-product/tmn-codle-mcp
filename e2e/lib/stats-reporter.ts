import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Reporter, File } from "vitest";

interface TestMeta {
  costUsd?: number;
  durationMs?: number;
  numTurns?: number;
  toolCallCount?: number;
  inputTokens?: number;
  outputTokens?: number;
}

interface Row {
  name: string;
  cost: number;
  duration: number;
  turns: number;
  toolCalls: number;
  inputTokens: number;
  outputTokens: number;
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export default class CostReporter implements Reporter {
  onFinished(files?: File[]) {
    if (!files?.length) return;

    const rows: Row[] = [];

    for (const file of files) {
      for (const task of file.tasks) {
        if (task.type !== "suite") continue;
        for (const t of task.tasks) {
          if (t.type !== "test") continue;
          const meta = t.meta as unknown as TestMeta;
          rows.push({
            name: `${task.name} > ${t.name}`,
            cost: meta?.costUsd ?? 0,
            duration: meta?.durationMs ?? 0,
            turns: meta?.numTurns ?? 0,
            toolCalls: meta?.toolCallCount ?? 0,
            inputTokens: meta?.inputTokens ?? 0,
            outputTokens: meta?.outputTokens ?? 0,
          });
        }
      }
    }

    if (!rows.length) return;

    const sum = (fn: (r: Row) => number) => rows.reduce((s, r) => s + fn(r), 0);
    const totalCost = sum((r) => r.cost);
    const totalDuration = sum((r) => r.duration);
    const totalInput = sum((r) => r.inputTokens);
    const totalOutput = sum((r) => r.outputTokens);
    const totalToolCalls = sum((r) => r.toolCalls);

    const header = "│ Cost     Time    Turns  Tools  In/Out Tokens   Test";
    const sep = "─".repeat(header.length);

    console.log(`\n┌${sep}`);
    console.log("│ E2E Stats");
    console.log(`├${sep}`);
    console.log(header);
    console.log(`├${sep}`);

    for (const row of rows) {
      const cost = `$${row.cost.toFixed(4)}`;
      const dur = `${(row.duration / 1000).toFixed(1)}s`;
      const turns = `${row.turns}`;
      const tools = `${row.toolCalls}`;
      const tokens = `${formatTokens(row.inputTokens)}/${formatTokens(
        row.outputTokens,
      )}`;
      console.log(
        `│ ${cost.padEnd(8)} ${dur.padEnd(7)} ${turns.padEnd(6)} ${tools.padEnd(
          6,
        )} ${tokens.padEnd(15)} ${row.name}`,
      );
    }

    console.log(`├${sep}`);
    const totTokens = `${formatTokens(totalInput)}/${formatTokens(
      totalOutput,
    )}`;
    const totCost = `$${totalCost.toFixed(4)}`;
    const totDur = `${(totalDuration / 1000).toFixed(1)}s`;
    const totTools = `${totalToolCalls}`;
    console.log(
      `│ ${totCost.padEnd(8)} ${totDur.padEnd(7)} ${"".padEnd(
        6,
      )} ${totTools.padEnd(6)} ${totTokens.padEnd(15)} TOTAL`,
    );
    console.log(`└${sep}`);

    this.writeMarkdown(rows, {
      totalCost,
      totalDuration,
      totalToolCalls,
      totalInput,
      totalOutput,
    });
  }

  private writeMarkdown(
    rows: Row[],
    totals: {
      totalCost: number;
      totalDuration: number;
      totalToolCalls: number;
      totalInput: number;
      totalOutput: number;
    },
  ) {
    const lines: string[] = [
      "## E2E Stats",
      "",
      "| Test | Cost | Time | Turns | Tools | Tokens (In/Out) |",
      "|------|------|------|-------|-------|-----------------|",
    ];

    for (const row of rows) {
      const cost = `$${row.cost.toFixed(4)}`;
      const dur = `${(row.duration / 1000).toFixed(1)}s`;
      const tokens = `${formatTokens(row.inputTokens)}/${formatTokens(
        row.outputTokens,
      )}`;
      lines.push(
        `| ${row.name} | ${cost} | ${dur} | ${row.turns} | ${row.toolCalls} | ${tokens} |`,
      );
    }

    const totTokens = `${formatTokens(totals.totalInput)}/${formatTokens(
      totals.totalOutput,
    )}`;
    lines.push(
      `| **TOTAL** | **$${totals.totalCost.toFixed(4)}** | **${(
        totals.totalDuration / 1000
      ).toFixed(1)}s** | | **${totals.totalToolCalls}** | **${totTokens}** |`,
    );
    lines.push("");

    const outPath = join(process.cwd(), "e2e", ".stats.md");
    writeFileSync(outPath, lines.join("\n"), "utf-8");
  }
}
