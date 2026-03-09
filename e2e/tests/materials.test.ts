import { describe, expect, test } from "../fixtures/claude.js";
import { createActivity, createMaterial } from "../lib/factory.js";
import { extractText, findToolResult } from "../lib/ndjson.js";

describe("search_materials", () => {
  test("seed한 내 자료가 결과에 포함", async ({ claude, factory }) => {
    const uniqueName = `e2e-mine-${Date.now()}`;
    await createMaterial(factory, { name: uniqueName });

    const result = await claude.run(`내 자료 중 "${uniqueName}"을 검색해줘.`);

    expect(result.errors).toHaveLength(0);
    expect(result.toolNames).toContain("mcp__codle__search_materials");

    const interaction = findToolResult(
      result.toolInteractions,
      "mcp__codle__search_materials",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);
    const text = extractText(interaction!.result!);
    expect(text).toContain(uniqueName);
  });

  test("비공개 자료가 공개 검색에서 제외", async ({ claude, factory }) => {
    const uniqueName = `e2e-not-public-${Date.now()}`;
    await createMaterial(factory, { name: uniqueName });

    const result = await claude.run("공개된 자료를 검색해줘.");

    expect(result.errors).toHaveLength(0);
    expect(result.toolNames).toContain("mcp__codle__search_materials");

    const interaction = findToolResult(
      result.toolInteractions,
      "mcp__codle__search_materials",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);
    const text = extractText(interaction!.result!);
    expect(text).not.toContain(uniqueName);
  });
});

describe("get_material_detail", () => {
  test("자료와 활동 ID 모두 포함", async ({ claude, factory }) => {
    const material = await createMaterial(factory);
    const activity = await createActivity(factory, material.id, {
      name: `e2e-activity-${Date.now()}`,
    });

    const result = await claude.run(
      `자료 ID "${material.id}"의 상세 정보를 조회해줘.`,
    );

    expect(result.errors).toHaveLength(0);
    expect(result.toolNames).toContain("mcp__codle__get_material_detail");

    const interaction = findToolResult(
      result.toolInteractions,
      "mcp__codle__get_material_detail",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);
    const text = extractText(interaction!.result!);
    expect(text).toContain(material.id);
    expect(text).toContain(activity.id);
  });
});

describe("manage_materials", () => {
  test("자료 생성 성공", async ({ claude }) => {
    const materialName = `E2E Test ${Date.now()}`;
    const result = await claude.run(
      `"${materialName}" 이름으로 새 자료를 만들어줘.`,
    );

    expect(result.errors).toHaveLength(0);
    expect(result.toolNames).toContain("mcp__codle__manage_materials");

    const interaction = findToolResult(
      result.toolInteractions,
      "mcp__codle__manage_materials",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);
    const text = extractText(interaction!.result!);
    expect(text).toMatch(/자료 생성 완료/);
    expect(text).toContain(materialName);
  });
});
