import {
  DecoratorNode,
  type LexicalNode,
  type SerializedLexicalNode,
} from "lexical";

export type SerializedHorizontalRuleNode = SerializedLexicalNode;

/**
 * AIDEV-NOTE: CDS의 @lexical/react/LexicalHorizontalRuleNode와 호환되는 headless 구현.
 * type "horizontalrule"로 직렬화되어 CDS LexicalEditor에서 그대로 렌더링 가능.
 */
export class HorizontalRuleNode extends DecoratorNode<null> {
  static getType(): string {
    return "horizontalrule";
  }

  static clone(node: HorizontalRuleNode): HorizontalRuleNode {
    return new HorizontalRuleNode(node.__key);
  }

  static importJSON(
    _serializedNode: SerializedHorizontalRuleNode,
  ): HorizontalRuleNode {
    return $createHorizontalRuleNode();
  }

  exportJSON(): SerializedHorizontalRuleNode {
    return { ...super.exportJSON(), type: "horizontalrule", version: 1 };
  }

  createDOM(): HTMLElement {
    // AIDEV-NOTE: headless 전용 — 런타임에 호출되지 않음
    throw new Error("Headless-only node");
  }

  updateDOM(): false {
    return false;
  }

  decorate(): null {
    return null;
  }
}

export function $createHorizontalRuleNode(): HorizontalRuleNode {
  return new HorizontalRuleNode();
}

export function $isHorizontalRuleNode(
  node: LexicalNode | null | undefined,
): node is HorizontalRuleNode {
  return node instanceof HorizontalRuleNode;
}
