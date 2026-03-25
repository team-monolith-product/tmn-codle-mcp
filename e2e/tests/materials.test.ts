import { describe, expect, test } from "../fixtures/claude.js";
import { createActivity, createMaterial } from "../lib/factory.js";
import {
  expectCodleCommand,
  findCodleInteraction,
  parseCodleOutput,
} from "../lib/ndjson.js";

describe("material search", () => {
  test("seed한 내 자료가 결과에 포함", async ({ claude, factory }) => {
    const uniqueName = `e2e-mine-${Date.now()}`;
    await createMaterial(factory, { name: uniqueName });

    const result = await claude.run(`내 자료 중 "${uniqueName}"을 검색해줘.`);

    expect(result.errors).toHaveLength(0);
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

    expect(result.errors).toHaveLength(0);
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

describe("material get", () => {
  test("자료와 활동 ID 모두 포함", async ({ claude, factory }) => {
    const material = await createMaterial(factory);
    const activity = await createActivity(factory, material.id, {
      name: `e2e-activity-${Date.now()}`,
    });

    const result = await claude.run(
      `자료 ID "${material.id}"의 상세 정보를 조회해줘.`,
    );

    expect(result.errors).toHaveLength(0);
    expectCodleCommand(result, "material get");

    const interaction = findCodleInteraction(
      result.toolInteractions,
      "material get",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);
    const output = JSON.stringify(parseCodleOutput(interaction!.result!));
    expect(output).toContain(material.id);
    expect(output).toContain(activity.id);
  });
});

describe("material create", () => {
  test("자료 생성 시 본문(markdown) 포함", async ({ claude }) => {
    const materialName = `E2E Body ${Date.now()}`;
    const result = await claude.run(
      `"${materialName}" 이름으로 새 자료를 만들어줘. 본문은 "# 학습 안내\n이 자료는 AI 기초를 다룹니다."로 해줘.`,
    );

    expect(result.errors).toHaveLength(0);
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

    expect(result.errors).toHaveLength(0);
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
