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

  it("converts an image", () => {
    const result = convertFromMarkdown("![alt text](https://example.com/img.png)");
    const children = result.root.children as Array<Record<string, unknown>>;
    expect(children).toHaveLength(1);
    const paragraph = children[0] as Record<string, unknown>;
    const inlineChildren = paragraph.children as Array<Record<string, unknown>>;
    const imageNode = inlineChildren.find((c) => c.type === "image");
    expect(imageNode).toBeDefined();
    expect(imageNode!.src).toBe("https://example.com/img.png");
    expect(imageNode!.altText).toBe("alt text");
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
