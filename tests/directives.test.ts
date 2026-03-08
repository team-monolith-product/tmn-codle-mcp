import { describe, it, expect } from "vitest";
import {
  extractDirectives,
  replaceDirectivePlaceholders,
} from "../src/lexical/directives.js";
import { convertFromMarkdown } from "../src/lexical/index.js";

// ── extractDirectives ──

describe("extractDirectives", () => {
  it("short-answer directive 추출", () => {
    const md = ':::short-answer{placeholder="이름"}\n:::';
    const { cleaned, directives } = extractDirectives(md);

    expect(cleaned.trim()).toBe("DIRECTIVEPLACEHOLDER0END");
    expect(directives).toHaveLength(1);
    expect(directives[0].nodeType).toBe("sheet-input");
    expect(directives[0].attrs.multiline).toBe("false");
    expect(directives[0].attrs.placeholder).toBe("이름");
  });

  it("long-answer directive 추출", () => {
    const md = ':::long-answer{placeholder="자유롭게 작성하세요"}\n:::';
    const { directives } = extractDirectives(md);

    expect(directives).toHaveLength(1);
    expect(directives[0].nodeType).toBe("sheet-input");
    expect(directives[0].attrs.multiline).toBe("true");
  });

  it("choice directive 추출 (선택지 파싱)", () => {
    const md = ":::choice{multiple=false}\n- A\n- B\n- C\n:::";
    const { directives } = extractDirectives(md);

    expect(directives).toHaveLength(1);
    expect(directives[0].nodeType).toBe("sheet-select");
    expect(directives[0].contentLines).toEqual(["- A", "- B", "- C"]);
    expect(directives[0].attrs.multiple).toBe("false");
  });

  it("self-eval directive 추출", () => {
    const md =
      ':::self-eval{icon=emoji labels="잘함,보통,부족"}\n- 질문1\n- 질문2\n:::';
    const { directives } = extractDirectives(md);

    expect(directives).toHaveLength(1);
    expect(directives[0].nodeType).toBe("self-evaluation");
    expect(directives[0].attrs.icon).toBe("emoji");
    expect(directives[0].attrs.labels).toBe("잘함,보통,부족");
    expect(directives[0].contentLines).toEqual(["- 질문1", "- 질문2"]);
  });

  it("일반 텍스트 + directive 혼합", () => {
    const md =
      '# 제목\n\n:::short-answer{placeholder="이름"}\n:::\n\n본문 텍스트';
    const { cleaned, directives } = extractDirectives(md);

    expect(directives).toHaveLength(1);
    expect(cleaned).toContain("# 제목");
    expect(cleaned).toContain("DIRECTIVEPLACEHOLDER0END");
    expect(cleaned).toContain("본문 텍스트");
  });

  it("여러 directive 추출", () => {
    const md = [
      ':::short-answer{placeholder="이름"}',
      ":::",
      "",
      ":::choice{multiple=true}",
      "- X",
      "- Y",
      ":::",
    ].join("\n");

    const { cleaned, directives } = extractDirectives(md);
    expect(directives).toHaveLength(2);
    expect(cleaned).toContain("DIRECTIVEPLACEHOLDER0END");
    expect(cleaned).toContain("DIRECTIVEPLACEHOLDER1END");
  });

  it("직전 텍스트와 blank line 없이 붙은 directive도 별도 paragraph로 분리", () => {
    const md = [
      "AI 서비스:",
      ':::short-answer{placeholder="적어 보세요"}',
      ":::",
      "이유:",
      ':::long-answer{placeholder="이유를 적어 보세요"}',
      ":::",
    ].join("\n");
    const { cleaned, directives } = extractDirectives(md);

    expect(directives).toHaveLength(2);
    // placeholder 앞에 blank line이 삽입되어 별도 paragraph가 된다
    const lines = cleaned.split("\n");
    const ph0Line = lines.findIndex((l) =>
      l.includes("DIRECTIVEPLACEHOLDER0END"),
    );
    const ph1Line = lines.findIndex((l) =>
      l.includes("DIRECTIVEPLACEHOLDER1END"),
    );
    // placeholder 바로 앞 줄은 blank line이어야 한다
    expect(lines[ph0Line - 1]).toBe("");
    expect(lines[ph1Line - 1]).toBe("");
  });

  it("알 수 없는 directive는 무시", () => {
    const md = ":::unknown{foo=bar}\n:::\n";
    const { cleaned, directives } = extractDirectives(md);

    expect(directives).toHaveLength(0);
    expect(cleaned).toContain(":::unknown{foo=bar}");
  });
});

// ── convertFromMarkdown with directives ──

describe("convertFromMarkdown + directives", () => {
  it("short-answer 노드 변환", () => {
    const md = ':::short-answer{placeholder="이름을 입력하세요"}\n:::';
    const result = convertFromMarkdown(md);
    const children = result.root.children as Array<Record<string, unknown>>;

    expect(children).toHaveLength(1);
    expect(children[0].type).toBe("sheet-input");
    expect(children[0].multiline).toBe(false);
    expect(children[0].placeholder).toBe("이름을 입력하세요");
    expect(children[0].value).toBe("");
  });

  it("long-answer 노드 변환", () => {
    const md = ':::long-answer{placeholder="자유롭게 작성하세요"}\n:::';
    const result = convertFromMarkdown(md);
    const children = result.root.children as Array<Record<string, unknown>>;

    expect(children[0].type).toBe("sheet-input");
    expect(children[0].multiline).toBe(true);
  });

  it("choice 노드 변환", () => {
    const md = ":::choice{multiple=false}\n- 사과\n- 바나나\n- 포도\n:::";
    const result = convertFromMarkdown(md);
    const children = result.root.children as Array<Record<string, unknown>>;

    expect(children).toHaveLength(1);
    const node = children[0];
    expect(node.type).toBe("sheet-select");
    expect(node.allowMultipleAnswers).toBe(false);

    const selections = node.selections as Array<{
      show: { text: string };
      value: string;
    }>;
    expect(selections).toHaveLength(3);
    expect(selections[0].show.text).toBe("사과");
    expect(selections[1].show.text).toBe("바나나");
    expect(selections[2].show.text).toBe("포도");
  });

  it("choice 노드 multiple=true", () => {
    const md = ":::choice{multiple=true}\n- A\n- B\n:::";
    const result = convertFromMarkdown(md);
    const node = (result.root.children as Array<Record<string, unknown>>)[0];
    expect(node.allowMultipleAnswers).toBe(true);
  });

  it("self-eval 노드 변환", () => {
    const md = [
      ':::self-eval{icon=emoji labels="잘함,보통,부족"}',
      "- AI의 개념을 이해했는가?",
      "- 데이터의 중요성을 설명할 수 있는가?",
      ":::",
    ].join("\n");
    const result = convertFromMarkdown(md);
    const children = result.root.children as Array<Record<string, unknown>>;

    expect(children).toHaveLength(1);
    const node = children[0];
    expect(node.type).toBe("self-evaluation");
    expect(node.iconType).toBe("emoji");
    expect(node.labels).toEqual(["잘함", "보통", "부족"]);

    const evals = node.evaluations as Array<{
      question: { text: string };
      selectedLabelIndex: number | null;
    }>;
    expect(evals).toHaveLength(2);
    expect(evals[0].question.text).toBe("AI의 개념을 이해했는가?");
    expect(evals[1].question.text).toBe("데이터의 중요성을 설명할 수 있는가?");
    expect(evals[0].selectedLabelIndex).toBeNull();
  });

  it("self-eval ascendingNumber 아이콘", () => {
    const md =
      ':::self-eval{icon=ascendingNumber labels="1점,2점,3점"}\n- 항목\n:::';
    const result = convertFromMarkdown(md);
    const node = (result.root.children as Array<Record<string, unknown>>)[0];
    expect(node.iconType).toBe("ascendingNumber");
    expect(node.labels).toEqual(["1점", "2점", "3점"]);
  });

  it("일반 Markdown과 directive 혼합 문서", () => {
    const md = [
      "# 활동지",
      "",
      "다음 질문에 답하세요.",
      "",
      ':::short-answer{placeholder="답을 입력하세요"}',
      ":::",
      "",
      "아래에서 골라보세요.",
      "",
      ":::choice{multiple=false}",
      "- 보기 1",
      "- 보기 2",
      ":::",
    ].join("\n");

    const result = convertFromMarkdown(md);
    const types = (result.root.children as Array<Record<string, unknown>>).map(
      (c) => c.type,
    );

    expect(types).toContain("heading");
    expect(types).toContain("paragraph");
    expect(types).toContain("sheet-input");
    expect(types).toContain("sheet-select");
  });

  it("텍스트 바로 뒤에 directive가 오면 placeholder가 노출되지 않음", () => {
    const md = [
      "AI 서비스:",
      ':::short-answer{placeholder="적어 보세요"}',
      ":::",
      "",
      "이유:",
      ':::long-answer{placeholder="이유를 적어 보세요"}',
      ":::",
    ].join("\n");
    const result = convertFromMarkdown(md);
    const types = (result.root.children as Array<Record<string, unknown>>).map(
      (c) => c.type,
    );

    expect(types).toContain("sheet-input");
    expect(types).not.toContain(undefined);

    // placeholder 문자열이 텍스트 노드에 남아있으면 안 된다
    const json = JSON.stringify(result);
    expect(json).not.toContain("DIRECTIVEPLACEHOLDER");
  });

  it("attrs 없는 directive", () => {
    const md = ":::short-answer\n:::";
    const result = convertFromMarkdown(md);
    const node = (result.root.children as Array<Record<string, unknown>>)[0];
    expect(node.type).toBe("sheet-input");
    expect(node.multiline).toBe(false);
    expect(node.placeholder).toBe("");
  });
});
