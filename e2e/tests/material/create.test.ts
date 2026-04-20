import { describe, expect, test } from "../../fixtures/claude.js";
import {
  expectCodleCommand,
  findCodleInteraction,
  parseCodleOutput,
} from "../../lib/ndjson.js";

describe("material create", () => {
  test("자료 생성 시 본문(markdown) 포함", async ({ claude }) => {
    const materialName = `E2E Body ${Date.now()}`;
    const result = await claude.run(
      `"${materialName}" 이름으로 새 자료를 만들어줘. 본문은 "# 학습 안내\n이 자료는 AI 기초를 다룹니다."로 해줘.`,
    );

    expectCodleCommand(result, "material create");

    const interaction = findCodleInteraction(
      result.toolInteractions,
      "material create",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);

    // CLI command should contain the body content
    const command = interaction!.call.input.command as string;
    expect(command).toContain("학습 안내");
  });

  test("자료 생성 성공", async ({ claude }) => {
    const materialName = `E2E Test ${Date.now()}`;
    const result = await claude.run(
      `"${materialName}" 이름으로 새 자료를 만들어줘.`,
    );

    expectCodleCommand(result, "material create");

    const interaction = findCodleInteraction(
      result.toolInteractions,
      "material create",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);
    const output = JSON.stringify(parseCodleOutput(interaction!.result!));
    expect(output).toContain(materialName);
  });
});
