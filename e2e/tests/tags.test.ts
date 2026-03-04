import { describe, expect, test } from "../fixtures/claude.js";

describe("tags", () => {
  test("manage_tags로 도메인별 태그 조회", async ({ claude }) => {
    const result = await claude.run(
      "manage_tags 도구로 domain='material' 태그 목록을 조회해줘. 도구를 반드시 호출해.",
    );

    expect(result.errors).toHaveLength(0);
    expect(result.toolNames).toContain("mcp__codle__manage_tags");
  });

  test("manage_tags로 키워드 검색", async ({ claude }) => {
    const result = await claude.run(
      "manage_tags 도구로 '파이썬' 키워드로 태그를 검색해줘. 도구를 반드시 호출해.",
    );

    expect(result.errors).toHaveLength(0);
    expect(result.toolNames).toContain("mcp__codle__manage_tags");
  });
});
