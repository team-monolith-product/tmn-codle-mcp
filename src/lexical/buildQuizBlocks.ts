import type { SerializedEditorState } from "lexical";

interface SelectChoice {
  text: string;
  isAnswer: boolean;
  imageUrl?: string;
  imageAlt?: string;
}

interface InputOptions {
  caseSensitive?: boolean;
  placeholder?: string;
}

function wrapRoot(children: Record<string, unknown>[]): SerializedEditorState {
  return {
    root: {
      type: "root",
      format: "",
      indent: 0,
      version: 1,
      direction: null,
      children,
    },
  } as unknown as SerializedEditorState;
}

// AIDEV-NOTE: problem-select/problem-input are CDS-specific Lexical nodes
// that cannot be produced by standard markdown→Lexical conversion.
// The JSON structure is derived from Rails factory specs and CDS node implementations.

// AIDEV-NOTE: Lexical 에디터 편집 모드에서 역직렬화하려면 root.children에
// paragraph + quiz노드 순서가 필요하다. 질문텍스트가 있으면 paragraph(질문) + paragraph(빈줄) + quiz노드,
// 없으면 paragraph(빈) + quiz노드. paragraph에는 textStyle, textFormat 필수.

function buildParagraph(text?: string): Record<string, unknown> {
  return {
    type: "paragraph",
    format: "",
    indent: 0,
    version: 1,
    direction: null,
    textStyle: "",
    textFormat: 0,
    children: text
      ? [
          {
            type: "text",
            text,
            mode: "normal",
            style: "",
            detail: 0,
            format: 0,
            version: 1,
          },
        ]
      : [],
  };
}

export function buildSelectBlock(
  choices: SelectChoice[],
  questionText?: string,
): SerializedEditorState {
  const hasMultipleSolutions = choices.filter((c) => c.isAnswer).length > 1;
  const selections = choices.map((c, i) => ({
    isAnswer: c.isAnswer,
    show: {
      text: c.text,
      image: c.imageUrl ? { src: c.imageUrl, altText: c.imageAlt ?? "" } : null,
    },
    value: String(i),
  }));
  const children: Record<string, unknown>[] = questionText
    ? [buildParagraph(questionText), buildParagraph()]
    : [buildParagraph()];
  children.push({
    type: "problem-select",
    version: 1,
    selected: [],
    selections,
    hasMultipleSolutions,
  });
  return wrapRoot(children);
}

export function buildInputBlock(
  solutions: string[],
  options?: InputOptions,
  questionText?: string,
): SerializedEditorState {
  // AIDEV-NOTE: solutions는 {value, textType} 객체 배열이어야 한다. CDS ProblemInputNode 참고.
  const node: Record<string, unknown> = {
    type: "problem-input",
    version: 1,
    answer: "",
    solutions: solutions.map((s) => ({ value: s, textType: "normal" })),
    placeholder: options?.placeholder ?? "",
    showCharacterNumber: false,
    caseSensitive: options?.caseSensitive ?? false,
    ignoreWhitespace: true,
  };
  const children: Record<string, unknown>[] = questionText
    ? [buildParagraph(questionText), buildParagraph()]
    : [buildParagraph()];
  children.push(node);
  return wrapRoot(children);
}
