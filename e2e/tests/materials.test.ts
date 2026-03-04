import { describe, expect, test } from "../fixtures/claude.js";

describe("materials", () => {
  test("search_materials로 공개 자료 검색", async ({ claude }) => {
    const result = await claude.run("공개된 자료 5개를 검색해줘.");

    expect(result.errors).toHaveLength(0);
    expect(result.toolNames).toContain("mcp__codle__search_materials");
  });

  test("자료 생성 후 상세 조회", async ({ claude }) => {
    const timestamp = Date.now();
    const result = await claude.run(
      `"E2E Test ${timestamp}" 이름으로 새 자료를 만들고, 만든 자료의 상세 정보를 조회해줘.`,
    );

    expect(result.errors).toHaveLength(0);
    expect(result.toolNames).toContain("mcp__codle__manage_materials");
    expect(result.toolNames).toContain("mcp__codle__get_material_detail");
  });
});
