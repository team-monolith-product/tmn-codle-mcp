import type { SerializedEditorState } from "lexical";
import { $convertFromMarkdownString, type Transformer } from "@lexical/markdown";
import { createHeadlessEditor } from "@lexical/headless";
import { nodes } from "./nodes/index.js";
import { CUSTOM_TRANSFORMERS } from "./transformers.js";

export function convertFromMarkdown(
  markdown: string,
  transformers?: Transformer[],
): SerializedEditorState {
  const editor = createHeadlessEditor({ nodes });

  editor.update(
    () => {
      $convertFromMarkdownString(markdown, transformers ?? CUSTOM_TRANSFORMERS);
    },
    { discrete: true },
  );

  return editor.getEditorState().toJSON();
}
