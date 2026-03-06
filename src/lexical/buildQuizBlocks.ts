import type { SerializedEditorState } from "lexical";

interface SelectChoice {
  text: string;
  isAnswer: boolean;
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
      direction: "ltr",
      children,
    },
  } as unknown as SerializedEditorState;
}

// AIDEV-NOTE: problem-select/problem-input are CDS-specific Lexical nodes
// that cannot be produced by standard markdown→Lexical conversion.
// The JSON structure is derived from Rails factory specs and CDS node implementations.

export function buildSelectBlock(
  choices: SelectChoice[],
): SerializedEditorState {
  const selections = choices.map((c) => ({
    isAnswer: c.isAnswer,
    show: { text: c.text },
    value: c.text,
  }));
  return wrapRoot([{ type: "problem-select", selections }]);
}

export function buildInputBlock(
  solutions: string[],
  options?: InputOptions,
): SerializedEditorState {
  const node: Record<string, unknown> = {
    type: "problem-input",
    solutions,
  };
  if (options?.caseSensitive !== undefined) {
    node.caseSensitive = options.caseSensitive;
  }
  if (options?.placeholder !== undefined) {
    node.placeholder = options.placeholder;
  }
  return wrapRoot([node]);
}
