import { describe, expect, test } from "../fixtures/claude.js";
import { createMaterial } from "../lib/factory.js";
import { extractText, findToolResult } from "../lib/ndjson.js";

describe("materials", () => {
  test("search_materials로 공개 자료 검색", async ({ claude }) => {
    const result = await claude.run("공개된 자료 5개를 검색해줘.");

    expect(result.errors).toHaveLength(0);
    expect(result.toolNames).toContain("mcp__codle__search_materials");

    const interaction = findToolResult(
      result.toolInteractions,
      "mcp__codle__search_materials",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);
    const text = extractText(interaction!.result!);
    expect(text).toMatch(/자료 목록|검색 결과가 없습니다/);
  });

  test("factory로 생성한 자료를 상세 조회", async ({ claude, factory }) => {
    const material = await createMaterial(factory);

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
  });

  test("자료 생성 후 상세 조회", async ({ claude }) => {
    const timestamp = Date.now();
    const materialName = `E2E Test ${timestamp}`;
    const result = await claude.run(
      `"${materialName}" 이름으로 새 자료를 만들고, 만든 자료의 상세 정보를 조회해줘.`,
    );

    expect(result.errors).toHaveLength(0);
    expect(result.toolNames).toContain("mcp__codle__manage_materials");
    expect(result.toolNames).toContain("mcp__codle__get_material_detail");

    const createInteraction = findToolResult(
      result.toolInteractions,
      "mcp__codle__manage_materials",
    );
    expect(createInteraction?.result).toBeDefined();
    expect(createInteraction!.result!.isError).toBe(false);
    const createText = extractText(createInteraction!.result!);
    expect(createText).toMatch(/자료 생성 완료/);
    expect(createText).toContain(materialName);
  });
});
