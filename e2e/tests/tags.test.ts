import { describe, expect, test } from "../fixtures/claude.js";
import { extractText, findToolResult } from "../lib/ndjson.js";

describe("manage_tags", () => {
  test("도메인별 태그 조회", async ({ claude }) => {
    const result = await claude.run("'material' 도메인의 태그 목록을 보여줘.");

    expect(result.errors).toHaveLength(0);
    expect(result.toolNames).toContain("mcp__codle__manage_tags");

    const interaction = findToolResult(
      result.toolInteractions,
      "mcp__codle__manage_tags",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);
    const text = extractText(interaction!.result!);
    expect(text).toMatch(/태그 목록|태그가 없습니다/);
  });

  test("키워드 검색", async ({ claude }) => {
    const result = await claude.run("'파이썬' 관련 태그를 검색해줘.");

    expect(result.errors).toHaveLength(0);
    expect(result.toolNames).toContain("mcp__codle__manage_tags");

    const interaction = findToolResult(
      result.toolInteractions,
      "mcp__codle__manage_tags",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);
  });
});
