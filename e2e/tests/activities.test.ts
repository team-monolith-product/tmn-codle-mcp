import { describe, expect, test } from "../fixtures/claude.js";

describe("activities", () => {
  test("활동 생성 + 코스 흐름 설정 + 삭제", async ({ claude }) => {
    const timestamp = Date.now();
    const result = await claude.run(
      [
        `다음 작업을 순서대로 수행해줘. 각 단계에서 도구를 반드시 호출해.`,
        `1. manage_materials 도구로 action="create", name="E2E Activity Test ${timestamp}" 자료를 생성해.`,
        `2. 생성된 자료 ID로 manage_activities 도구를 사용해 action="create", name="E2E Activity 1", activity_type="HtmlActivity" 활동을 생성해.`,
        `3. 같은 자료 ID로 manage_activities 도구를 사용해 action="create", name="E2E Activity 2", activity_type="HtmlActivity" 활동을 생성해.`,
        `4. set_activity_flow 도구로 자료 ID와 두 활동 ID를 사용해 코스 흐름을 설정해.`,
        `5. get_material_detail 도구로 자료 상세를 조회해서 흐름이 설정되었는지 확인해.`,
        `6. manage_activities 도구로 두 활동을 각각 action="delete"로 삭제해.`,
      ].join("\n"),
    );

    // AIDEV-NOTE: 활동 삭제 API가 빈 body를 반환하여 "Unexpected end of JSON input" 발생.
    // sibling tool call error는 병렬 호출 실패의 연쇄 에러. 이 두 종류는 허용한다.
    const significantErrors = result.errors.filter(
      (e) =>
        !e.includes("Unexpected end of JSON input") &&
        !e.includes("Sibling tool call errored"),
    );
    expect(significantErrors, `Tool errors: ${JSON.stringify(significantErrors)}`).toHaveLength(0);
    expect(result.toolNames).toContain("mcp__codle__manage_materials");
    expect(result.toolNames).toContain("mcp__codle__manage_activities");
    expect(result.toolNames).toContain("mcp__codle__set_activity_flow");
    expect(result.toolNames).toContain("mcp__codle__get_material_detail");
  });
});
