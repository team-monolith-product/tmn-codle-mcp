import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { TableCellNode, TableNode, TableRowNode } from "@lexical/table";
import { ListItemNode, ListNode } from "@lexical/list";
import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { AutoLinkNode, LinkNode } from "@lexical/link";
import type { Klass, LexicalNode } from "lexical";
import { HorizontalRuleNode } from "./HorizontalRuleNode.js";
import { ImageNode } from "./ImageNode.js";

export {
  HorizontalRuleNode,
  $createHorizontalRuleNode,
  $isHorizontalRuleNode,
} from "./HorizontalRuleNode.js";
export {
  ImageNode,
  $createImageNode,
  $isImageNode,
  type ImagePayload,
  type SerializedImageNode,
} from "./ImageNode.js";

/**
 * AIDEV-NOTE: CDS LexicalEditor의 nodes 목록에서 headless에서 사용 가능한 것만 포함.
 * CDS 전용 노드(ProblemInputNode, SheetSelectNode 등)는 React 의존성이 있어 제외.
 */
export const nodes: Klass<LexicalNode>[] = [
  HeadingNode,
  ListNode,
  ListItemNode,
  QuoteNode,
  CodeNode,
  CodeHighlightNode,
  TableNode,
  TableCellNode,
  TableRowNode,
  AutoLinkNode,
  LinkNode,
  ImageNode,
  HorizontalRuleNode,
];
