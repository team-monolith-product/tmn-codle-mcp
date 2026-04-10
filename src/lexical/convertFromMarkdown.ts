import type { SerializedEditorState } from "lexical";
import {
  $convertFromMarkdownString,
  type Transformer,
} from "@lexical/markdown";
import { createHeadlessEditor } from "@lexical/headless";
import { nodes } from "./nodes/index.js";
import { CUSTOM_TRANSFORMERS } from "./transformers.js";
import {
  extractDirectives,
  replaceDirectivePlaceholders,
} from "./directives.js";

export function convertFromMarkdown(
  markdown: string,
  transformers?: Transformer[],
): SerializedEditorState {
  const { cleaned, directives } = extractDirectives(markdown);

  const editor = createHeadlessEditor({ nodes });

  editor.update(
    () => {
      $convertFromMarkdownString(cleaned, transformers ?? CUSTOM_TRANSFORMERS);
    },
    { discrete: true },
  );

  const state = editor.getEditorState().toJSON();
  return replaceDirectivePlaceholders(state, directives);
}
