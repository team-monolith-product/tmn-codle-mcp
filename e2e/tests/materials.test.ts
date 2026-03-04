import { describe, expect, test } from "../fixtures/claude.js";

describe("materials", () => {
  test("search_materials로 공개 자료 검색", async ({ claude }) => {
    const result = await claude.run(
      "search_materials 도구로 is_public=true, page_size=5로 공개 자료를 검색해줘. 도구를 반드시 호출해.",
    );

    expect(result.errors).toHaveLength(0);
    expect(result.toolNames).toContain("mcp__codle__search_materials");
  });

  test("자료 생성 후 상세 조회", async ({ claude }) => {
    const timestamp = Date.now();
    const result = await claude.run(
      [
        `다음 작업을 순서대로 수행해줘. 각 단계에서 도구를 반드시 호출해.`,
        `1. manage_materials 도구로 action="create", name="E2E Test ${timestamp}" 자료를 생성해.`,
        `2. 생성된 자료의 ID로 get_material_detail 도구를 호출해서 상세 정보를 조회해.`,
      ].join("\n"),
    );

    expect(result.errors).toHaveLength(0);
    expect(result.toolNames).toContain("mcp__codle__manage_materials");
    expect(result.toolNames).toContain("mcp__codle__get_material_detail");
  });
});
