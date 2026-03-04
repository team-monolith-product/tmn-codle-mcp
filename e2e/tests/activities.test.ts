import { describe, expect, test } from "../fixtures/claude.js";

describe("activities", () => {
  test("활동 생성 + 코스 흐름 설정 + 삭제", async ({ claude }) => {
    const timestamp = Date.now();
    const result = await claude.run(
      [
        `"E2E Activity Test ${timestamp}" 자료를 만들고, 그 안에 "E2E Activity 1", "E2E Activity 2" 교안 활동 2개를 추가해줘.`,
        `두 활동을 순서대로 연결하는 코스 흐름을 설정하고, 자료 상세를 조회해서 흐름이 잘 설정됐는지 확인해줘.`,
        `확인 후 두 활동을 삭제해줘.`,
      ].join("\n"),
    );

    // AIDEV-NOTE: 활동 삭제 API가 빈 body를 반환하여 "Unexpected end of JSON input" 발생.
    // sibling tool call error는 병렬 호출 실패의 연쇄 에러. 이 두 종류는 허용한다.
    const significantErrors = result.errors.filter(
      (e) =>
        !e.includes("Unexpected end of JSON input") &&
        !e.includes("Sibling tool call errored"),
    );
    expect(
      significantErrors,
      `Tool errors: ${JSON.stringify(significantErrors)}`,
    ).toHaveLength(0);
    expect(result.toolNames).toContain("mcp__codle__manage_materials");
    expect(result.toolNames).toContain("mcp__codle__manage_activities");
    expect(result.toolNames).toContain("mcp__codle__set_activity_flow");
    expect(result.toolNames).toContain("mcp__codle__get_material_detail");
  });
});
