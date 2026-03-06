import { describe, it, expect } from "vitest";
import {
  buildSelectBlock,
  buildInputBlock,
} from "../src/lexical/buildQuizBlocks.js";

describe("buildSelectBlock", () => {
  it("O/X choices", () => {
    const result = buildSelectBlock([
      { text: "O", isAnswer: true },
      { text: "X", isAnswer: false },
    ]);

    expect(result.root.type).toBe("root");
    const children = (result.root as Record<string, unknown>).children as Array<
      Record<string, unknown>
    >;
    expect(children).toHaveLength(1);

    const node = children[0];
    expect(node.type).toBe("problem-select");

    const selections = node.selections as Array<Record<string, unknown>>;
    expect(selections).toHaveLength(2);
    expect(selections[0]).toEqual({
      isAnswer: true,
      show: { text: "O" },
      value: "O",
    });
    expect(selections[1]).toEqual({
      isAnswer: false,
      show: { text: "X" },
      value: "X",
    });
  });

  it("multiple choice with 4 options", () => {
    const result = buildSelectBlock([
      { text: "사과", isAnswer: false },
      { text: "바나나", isAnswer: true },
      { text: "포도", isAnswer: false },
      { text: "수박", isAnswer: false },
    ]);

    const children = (result.root as Record<string, unknown>).children as Array<
      Record<string, unknown>
    >;
    const selections = children[0].selections as Array<Record<string, unknown>>;
    expect(selections).toHaveLength(4);
    expect(selections[1].isAnswer).toBe(true);
    expect(selections[0].isAnswer).toBe(false);
  });

  it("root structure matches Lexical format", () => {
    const result = buildSelectBlock([
      { text: "A", isAnswer: true },
      { text: "B", isAnswer: false },
    ]);

    const root = result.root as Record<string, unknown>;
    expect(root.format).toBe("");
    expect(root.indent).toBe(0);
    expect(root.version).toBe(1);
    expect(root.direction).toBe("ltr");
  });
});

describe("buildInputBlock", () => {
  it("single solution", () => {
    const result = buildInputBlock(["42"]);

    const children = (result.root as Record<string, unknown>).children as Array<
      Record<string, unknown>
    >;
    expect(children).toHaveLength(1);

    const node = children[0];
    expect(node.type).toBe("problem-input");
    expect(node.solutions).toEqual(["42"]);
  });

  it("multiple solutions", () => {
    const result = buildInputBlock(["서울", "Seoul"]);

    const children = (result.root as Record<string, unknown>).children as Array<
      Record<string, unknown>
    >;
    const node = children[0];
    expect(node.solutions).toEqual(["서울", "Seoul"]);
  });

  it("with caseSensitive option", () => {
    const result = buildInputBlock(["Hello"], { caseSensitive: true });

    const children = (result.root as Record<string, unknown>).children as Array<
      Record<string, unknown>
    >;
    const node = children[0];
    expect(node.caseSensitive).toBe(true);
  });

  it("with placeholder option", () => {
    const result = buildInputBlock(["정답"], {
      placeholder: "답을 입력하세요",
    });

    const children = (result.root as Record<string, unknown>).children as Array<
      Record<string, unknown>
    >;
    const node = children[0];
    expect(node.placeholder).toBe("답을 입력하세요");
  });

  it("no options omits optional fields", () => {
    const result = buildInputBlock(["test"]);

    const children = (result.root as Record<string, unknown>).children as Array<
      Record<string, unknown>
    >;
    const node = children[0];
    expect(node.caseSensitive).toBeUndefined();
    expect(node.placeholder).toBeUndefined();
  });
});
