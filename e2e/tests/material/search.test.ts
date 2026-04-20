import { describe, expect, test } from "../../fixtures/claude.js";
import { createMaterial } from "../../lib/factory.js";
import {
  expectCodleCommand,
  findCodleInteraction,
  parseCodleOutput,
} from "../../lib/ndjson.js";

describe("material search", () => {
  test("seed한 내 자료가 결과에 포함", async ({ claude, factory }) => {
    const uniqueName = `e2e-mine-${Date.now()}`;
    await createMaterial(factory, { name: uniqueName });

    const result = await claude.run(`내 자료 중 "${uniqueName}"을 검색해줘.`);

    expectCodleCommand(result, "material search");

    const interaction = findCodleInteraction(
      result.toolInteractions,
      "material search",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);
    const output = JSON.stringify(parseCodleOutput(interaction!.result!));
    expect(output).toContain(uniqueName);
  });

  test("비공개 자료가 공개 검색에서 제외", async ({ claude, factory }) => {
    const uniqueName = `e2e-not-public-${Date.now()}`;
    await createMaterial(factory, { name: uniqueName });

    const result = await claude.run("공개된 자료를 검색해줘.");

    expectCodleCommand(result, "material search");

    const interaction = findCodleInteraction(
      result.toolInteractions,
      "material search",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);
    const output = JSON.stringify(parseCodleOutput(interaction!.result!));
    expect(output).not.toContain(uniqueName);
  });
});
