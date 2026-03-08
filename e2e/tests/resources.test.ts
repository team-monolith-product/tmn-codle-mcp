import { describe, expect, test } from "../fixtures/claude.js";
import { findToolResult, extractText } from "../lib/ndjson.js";

// AIDEV-NOTE: 프롬프트에서 directive나 resource를 직접 언급하지 않는다.
// AI가 tool description 힌트 → resource 읽기 → directive 문법 사용의 전체 흐름을 자연스럽게 수행하는지 검증한다.

describe("sheet-directives resource", () => {
  test("활동지 문제에 단답형 + 선택지 입력란 생성", async ({ claude }) => {
    const result = await claude.run(
      `"E2E 입력란" 제목으로 활동지(sheet) 문제를 만들어줘.\n` +
        `본문에 다음 입력란을 포함해줘:\n` +
        `- 단답형 입력란 (placeholder: "답 입력")\n` +
        `- 선택지: 사과, 바나나, 포도`,
    );

    expect(result.errors).toHaveLength(0);

    const interaction = findToolResult(
      result.toolInteractions,
      "mcp__codle__manage_problems",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);
    expect(extractText(interaction!.result!)).toMatch(/문제 생성 완료/);

    const input = interaction!.call.input;
    expect(input.problem_type).toBe("sheet");

    const content = input.content as string;
    expect(content).toMatch(/:::short-answer/);
    expect(content).toMatch(/:::choice/);
  });

  test("활동지 문제에 서술형 + 자기평가 입력란 생성", async ({ claude }) => {
    const result = await claude.run(
      `"E2E 서술평가" 제목으로 활동지(sheet) 문제를 만들어줘.\n` +
        `본문에 다음 입력란을 포함해줘:\n` +
        `- 서술형 입력란 (placeholder: "느낀 점")\n` +
        `- 자기평가: labels는 "잘함,보통,노력필요", 질문은 "적극적으로 참여했다"와 "의견을 존중했다"`,
    );

    expect(result.errors).toHaveLength(0);

    const interaction = findToolResult(
      result.toolInteractions,
      "mcp__codle__manage_problems",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);
    expect(extractText(interaction!.result!)).toMatch(/문제 생성 완료/);

    const input = interaction!.call.input;
    expect(input.problem_type).toBe("sheet");

    const content = input.content as string;
    expect(content).toMatch(/:::long-answer/);
    expect(content).toMatch(/:::self-eval/);
  });
});
