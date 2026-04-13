import { describe, it, expect } from "vitest";
import { convertFromMarkdown } from "../src/lexical/index.js";

describe("convertFromMarkdown", () => {
  it("converts a heading", () => {
    const result = convertFromMarkdown("# Hello");
    const root = result.root;
    expect(root.type).toBe("root");
    const children = root.children as Array<Record<string, unknown>>;
    expect(children).toHaveLength(1);
    expect(children[0].type).toBe("heading");
    expect(children[0].tag).toBe("h1");
  });

  it("converts a paragraph with bold text", () => {
    const result = convertFromMarkdown("Hello **world**");
    const children = result.root.children as Array<Record<string, unknown>>;
    expect(children).toHaveLength(1);
    expect(children[0].type).toBe("paragraph");
  });

  it("converts an unordered list", () => {
    const result = convertFromMarkdown("- item 1\n- item 2");
    const children = result.root.children as Array<Record<string, unknown>>;
    expect(children).toHaveLength(1);
    expect(children[0].type).toBe("list");
  });

  it("converts a code block", () => {
    const result = convertFromMarkdown("```js\nconsole.log('hi');\n```");
    const children = result.root.children as Array<Record<string, unknown>>;
    expect(children).toHaveLength(1);
    expect(children[0].type).toBe("code");
  });

  it("converts a horizontal rule", () => {
    const result = convertFromMarkdown("---");
    const children = result.root.children as Array<Record<string, unknown>>;
    expect(children).toHaveLength(1);
    expect(children[0].type).toBe("horizontalrule");
  });

  it("converts an image to a root-level block (CDS ImageNode is block-level)", () => {
    const result = convertFromMarkdown(
      "![alt text](https://example.com/img.png)",
    );
    const children = result.root.children as Array<Record<string, unknown>>;
    // image는 paragraph 안이 아니라 root.children 직속이어야 한다.
    expect(children).toHaveLength(1);
    expect(children[0].type).toBe("image");
    expect(children[0].src).toBe("https://example.com/img.png");
    expect(children[0].altText).toBe("alt text");
  });

  it("splits a paragraph with inline image into text/image/text blocks", () => {
    const result = convertFromMarkdown(
      "hello ![alt](https://example.com/img.png) world",
    );
    const children = result.root.children as Array<Record<string, unknown>>;
    expect(children).toHaveLength(3);
    expect(children[0].type).toBe("paragraph");
    expect(children[1].type).toBe("image");
    expect(children[2].type).toBe("paragraph");
  });

  it("converts a table", () => {
    const md = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    const result = convertFromMarkdown(md);
    const children = result.root.children as Array<Record<string, unknown>>;
    expect(children).toHaveLength(1);
    expect(children[0].type).toBe("table");
  });

  it("converts a complex document", () => {
    const md = [
      "# Title",
      "",
      "Some **bold** and *italic* text.",
      "",
      "- item 1",
      "- item 2",
      "",
      "---",
      "",
      "```python",
      "print('hello')",
      "```",
    ].join("\n");

    const result = convertFromMarkdown(md);
    const children = result.root.children as Array<Record<string, unknown>>;
    const types = children.map((c) => c.type);
    expect(types).toContain("heading");
    expect(types).toContain("paragraph");
    expect(types).toContain("list");
    expect(types).toContain("horizontalrule");
    expect(types).toContain("code");
  });
});
