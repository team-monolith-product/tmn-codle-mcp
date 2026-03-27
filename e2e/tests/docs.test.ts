import { describe, expect, test } from "../fixtures/claude.js";
import { expectCodleCommand, findCodleInteraction } from "../lib/ndjson.js";

// AIDEV-NOTE: 프롬프트에서 directive나 resource를 직접 언급하지 않는다.
// AI가 tool description 힌트 → docs 읽기 → directive 문법 사용의 전체 흐름을 자연스럽게 수행하는지 검증한다.

describe("sheet-directives docs", () => {
  test("활동지 문제에 단답형 + 선택지 입력란 생성", async ({ claude }) => {
    const result = await claude.run(
      `"E2E 입력란" 제목으로 활동지(sheet) 문제를 만들어줘.\n` +
        `본문에 다음 입력란을 포함해줘:\n` +
        `- 단답형 입력란 (placeholder: "답 입력")\n` +
        `- 선택지: 사과, 바나나, 포도`,
    );

    expectCodleCommand(result, "problem create");

    const interaction = findCodleInteraction(
      result.toolInteractions,
      "problem create",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);

    const command = interaction!.call.input.command as string;
    expect(command).toContain("sheet");

    // The content should include directive syntax
    expect(command).toMatch(/:::short-answer/);
    expect(command).toMatch(/:::choice/);
  });

  test("활동지 문제에 서술형 + 자기평가 입력란 생성", async ({ claude }) => {
    const result = await claude.run(
      `"E2E 서술평가" 제목으로 활동지(sheet) 문제를 만들어줘.\n` +
        `본문에 다음 입력란을 포함해줘:\n` +
        `- 서술형 입력란 (placeholder: "느낀 점")\n` +
        `- 자기평가: labels는 "잘함,보통,노력필요", 질문은 "적극적으로 참여했다"와 "의견을 존중했다"`,
    );

    expectCodleCommand(result, "problem create");

    const interaction = findCodleInteraction(
      result.toolInteractions,
      "problem create",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);

    const command = interaction!.call.input.command as string;
    expect(command).toContain("sheet");

    // The content should include directive syntax
    expect(command).toMatch(/:::long-answer/);
    expect(command).toMatch(/:::self-eval/);
  });
});
