import { describe, expect, test } from "../fixtures/claude.js";

describe("tags", () => {
  test("manage_tags로 도메인별 태그 조회", async ({ claude }) => {
    const result = await claude.run("'material' 도메인의 태그 목록을 보여줘.");

    expect(result.errors).toHaveLength(0);
    expect(result.toolNames).toContain("mcp__codle__manage_tags");
  });

  test("manage_tags로 키워드 검색", async ({ claude }) => {
    const result = await claude.run("'파이썬' 관련 태그를 검색해줘.");

    expect(result.errors).toHaveLength(0);
    expect(result.toolNames).toContain("mcp__codle__manage_tags");
  });
});
