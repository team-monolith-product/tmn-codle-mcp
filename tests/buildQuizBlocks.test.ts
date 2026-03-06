import { describe, it, expect } from "vitest";
import {
  buildSelectBlock,
  buildInputBlock,
} from "../src/lexical/buildQuizBlocks.js";

/** root.children 추출 헬퍼 */
function getChildren(
  result: ReturnType<typeof buildSelectBlock>,
): Array<Record<string, unknown>> {
  return (result.root as Record<string, unknown>).children as Array<
    Record<string, unknown>
  >;
}

/** paragraph → text 노드의 텍스트 추출 */
function getParagraphText(node: Record<string, unknown>): string {
  const children = node.children as Array<Record<string, unknown>>;
  return children.length ? String(children[0].text) : "";
}

/** 마지막 child에서 quiz 노드 추출 */
function getQuizNode(
  result: ReturnType<typeof buildSelectBlock>,
): Record<string, unknown> {
  const children = getChildren(result);
  return children[children.length - 1];
}

describe("buildSelectBlock", () => {
  it("O/X choices with question text", () => {
    const result = buildSelectBlock(
      [
        { text: "O", isAnswer: true },
        { text: "X", isAnswer: false },
      ],
      "다음 중 맞는 것은?",
    );

    expect(result.root.type).toBe("root");
    const children = getChildren(result);
    // questionText 있으면: paragraph(질문) + paragraph(빈) + problem-select
    expect(children).toHaveLength(3);

    expect(children[0].type).toBe("paragraph");
    expect(getParagraphText(children[0])).toBe("다음 중 맞는 것은?");

    expect(children[1].type).toBe("paragraph");
    expect(children[1].children).toEqual([]);

    const node = children[2];
    expect(node.type).toBe("problem-select");
    expect(node.version).toBe(1);
    expect(node.selected).toEqual([]);
    expect(node.hasMultipleSolutions).toBe(false);

    const selections = node.selections as Array<Record<string, unknown>>;
    expect(selections).toHaveLength(2);
    expect(selections[0]).toEqual({
      isAnswer: true,
      show: { text: "O", image: null },
      value: "0",
    });
    expect(selections[1]).toEqual({
      isAnswer: false,
      show: { text: "X", image: null },
      value: "1",
    });
  });

  it("without questionText produces single empty paragraph", () => {
    const result = buildSelectBlock([
      { text: "A", isAnswer: true },
      { text: "B", isAnswer: false },
    ]);

    const children = getChildren(result);
    // questionText 없으면: paragraph(빈) + problem-select
    expect(children).toHaveLength(2);
    expect(children[0].type).toBe("paragraph");
    expect(children[0].children).toEqual([]);
    expect(children[1].type).toBe("problem-select");
  });

  it("multiple choice with 4 options", () => {
    const result = buildSelectBlock([
      { text: "사과", isAnswer: false },
      { text: "바나나", isAnswer: true },
      { text: "포도", isAnswer: false },
      { text: "수박", isAnswer: false },
    ]);

    const node = getQuizNode(result);
    const selections = node.selections as Array<Record<string, unknown>>;
    expect(selections).toHaveLength(4);
    expect(selections[1].isAnswer).toBe(true);
    expect(selections[0].isAnswer).toBe(false);
  });

  it("choices with imageUrl produce show.image object", () => {
    const result = buildSelectBlock([
      {
        text: "사과",
        isAnswer: true,
        imageUrl: "https://example.com/apple.png",
        imageAlt: "사과 이미지",
      },
      {
        text: "바나나",
        isAnswer: false,
        imageUrl: "https://example.com/banana.png",
      },
      { text: "포도", isAnswer: false },
    ]);

    const node = getQuizNode(result);
    const selections = node.selections as Array<Record<string, unknown>>;
    expect(selections).toHaveLength(3);
    expect(selections[0]).toEqual({
      isAnswer: true,
      show: {
        text: "사과",
        image: {
          src: "https://example.com/apple.png",
          altText: "사과 이미지",
        },
      },
      value: "0",
    });
    expect(selections[1]).toEqual({
      isAnswer: false,
      show: {
        text: "바나나",
        image: { src: "https://example.com/banana.png", altText: "" },
      },
      value: "1",
    });
    expect(selections[2]).toEqual({
      isAnswer: false,
      show: { text: "포도", image: null },
      value: "2",
    });
  });

  it("paragraph has textStyle and textFormat fields", () => {
    const result = buildSelectBlock([{ text: "A", isAnswer: true }]);

    const children = getChildren(result);
    const paragraph = children[0];
    expect(paragraph.textStyle).toBe("");
    expect(paragraph.textFormat).toBe(0);
    expect(paragraph.direction).toBeNull();
  });

  it("paragraph with question text has correct text node format", () => {
    const result = buildSelectBlock([{ text: "A", isAnswer: true }], "질문");

    const children = getChildren(result);
    const questionParagraph = children[0];
    const textNode = (
      questionParagraph.children as Array<Record<string, unknown>>
    )[0];
    expect(textNode.mode).toBe("normal");
    expect(textNode.style).toBe("");
    expect(textNode.detail).toBe(0);
    expect(textNode.format).toBe(0);
    expect(textNode.version).toBe(1);
  });
});

describe("buildInputBlock", () => {
  it("single solution with question text", () => {
    const result = buildInputBlock(["42"], undefined, "정답은?");

    const children = getChildren(result);
    // questionText 있으면: paragraph(질문) + paragraph(빈) + problem-input
    expect(children).toHaveLength(3);

    expect(children[0].type).toBe("paragraph");
    expect(getParagraphText(children[0])).toBe("정답은?");
    expect(children[1].type).toBe("paragraph");
    expect(children[1].children).toEqual([]);

    const node = children[2];
    expect(node.type).toBe("problem-input");
    expect(node.solutions).toEqual([{ value: "42", textType: "normal" }]);
  });

  it("without questionText produces single empty paragraph", () => {
    const result = buildInputBlock(["42"]);

    const children = getChildren(result);
    // questionText 없으면: paragraph(빈) + problem-input
    expect(children).toHaveLength(2);
    expect(children[0].type).toBe("paragraph");
    expect(children[0].children).toEqual([]);
    expect(children[1].type).toBe("problem-input");
  });

  it("multiple solutions", () => {
    const result = buildInputBlock(["서울", "Seoul"]);
    const node = getQuizNode(result);
    expect(node.solutions).toEqual([
      { value: "서울", textType: "normal" },
      { value: "Seoul", textType: "normal" },
    ]);
  });

  it("with caseSensitive option", () => {
    const result = buildInputBlock(["Hello"], { caseSensitive: true });
    const node = getQuizNode(result);
    expect(node.caseSensitive).toBe(true);
  });

  it("with placeholder option", () => {
    const result = buildInputBlock(["정답"], {
      placeholder: "답을 입력하세요",
    });
    const node = getQuizNode(result);
    expect(node.placeholder).toBe("답을 입력하세요");
  });

  it("defaults: version, answer, showCharacterNumber, ignoreWhitespace, caseSensitive, placeholder", () => {
    const result = buildInputBlock(["test"]);
    const node = getQuizNode(result);
    expect(node.version).toBe(1);
    expect(node.answer).toBe("");
    expect(node.showCharacterNumber).toBe(false);
    expect(node.ignoreWhitespace).toBe(true);
    expect(node.caseSensitive).toBe(false);
    expect(node.placeholder).toBe("");
  });
});
