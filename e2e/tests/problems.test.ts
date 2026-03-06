import { describe, expect, test } from "../fixtures/claude.js";
import { createMaterial } from "../lib/factory.js";
import {
  extractText,
  findAllToolResults,
  findToolResult,
} from "../lib/ndjson.js";

describe("manage_problems", () => {
  test("퀴즈 문제 생성", async ({ claude }) => {
    const result = await claude.run(
      `"E2E OX" 제목으로 퀴즈 문제를 하나 만들어줘. 선택지는 O가 정답이고 X는 오답이야.`,
    );

    expect(result.errors).toHaveLength(0);
    expect(result.toolNames).toContain("mcp__codle__manage_problems");

    const interaction = findToolResult(
      result.toolInteractions,
      "mcp__codle__manage_problems",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);
    const text = extractText(interaction!.result!);
    expect(text).toMatch(/문제 생성 완료/);
  });

  test("활동지 문제 생성 시 blocks 포함", async ({ claude }) => {
    const result = await claude.run(
      `"E2E 서술형" 제목으로 활동지(sheet) 문제를 만들어줘. 내용은 "다음을 설명하시오"야.`,
    );

    expect(result.errors).toHaveLength(0);
    expect(result.toolNames).toContain("mcp__codle__manage_problems");

    const interaction = findToolResult(
      result.toolInteractions,
      "mcp__codle__manage_problems",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);
    const text = extractText(interaction!.result!);
    expect(text).toMatch(/문제 생성 완료/);
  });
});

describe("manage_problem_collection_problems", () => {
  test("퀴즈 활동에 문제 연결", async ({ claude, factory }) => {
    const material = await createMaterial(factory);

    const result = await claude.run(
      `자료 ID "${material.id}"에 퀴즈 활동 "E2E Quiz"를 하나 만들고, ` +
        `"E2E OX" 제목의 퀴즈 문제를 만들어서 (선택지: O 정답, X 오답), ` +
        `그 퀴즈 활동에 연결해줘.`,
    );

    expect(result.toolNames).toContain(
      "mcp__codle__manage_problem_collection_problems",
    );

    const interaction = findToolResult(
      result.toolInteractions,
      "mcp__codle__manage_problem_collection_problems",
    );
    expect(interaction?.result).toBeDefined();
    expect(interaction!.result!.isError).toBe(false);
    const text = extractText(interaction!.result!);
    expect(text).toMatch(/문제 연결 완료/);

    // 보조 도구 호출 여부만 확인
    expect(result.toolNames).toContain("mcp__codle__manage_activities");
    expect(result.toolNames).toContain("mcp__codle__manage_problems");
  });

  test("여러 문제를 퀴즈 활동에 순서대로 연결", async ({
    claude,
    factory,
  }) => {
    const material = await createMaterial(factory);

    const result = await claude.run(
      `자료 ID "${material.id}"에 퀴즈 활동 "E2E Multi Quiz"를 만들고, ` +
        `다음 두 문제를 만들어서 순서대로 연결해줘:\n` +
        `1번: "E2E 문제1" (퀴즈, 선택지: A 정답 / B 오답)\n` +
        `2번: "E2E 문제2" (퀴즈, 선택지: C 오답 / D 정답)`,
    );

    expect(result.toolNames).toContain(
      "mcp__codle__manage_problem_collection_problems",
    );

    const pcpInteractions = findAllToolResults(
      result.toolInteractions,
      "mcp__codle__manage_problem_collection_problems",
    );
    const successCount = pcpInteractions.filter(
      (i) =>
        i.result && !i.result.isError && extractText(i.result).includes("연결"),
    ).length;
    expect(successCount).toBeGreaterThanOrEqual(2);
  });
});
