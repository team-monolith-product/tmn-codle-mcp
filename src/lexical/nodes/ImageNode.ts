import {
  DecoratorNode,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from "lexical";
import { createHeadlessEditor } from "@lexical/headless";

export interface ImagePayload {
  src: string;
  altText: string;
  maxWidth?: number;
  width?: number;
  height?: number;
}

interface SerializedEditor {
  editorState: {
    root: Record<string, unknown>;
  };
}

export type SerializedImageNode = Spread<
  {
    src: string;
    altText: string;
    maxWidth: number;
    width: number;
    height: number;
    showCaption: boolean;
    caption: SerializedEditor;
  },
  SerializedLexicalNode
>;

// AIDEV-NOTE: CDS ImageNode의 caption은 중첩 LexicalEditor.
// headless에서는 빈 에디터 상태로 직렬화하여 CDS와 호환 유지.
const EMPTY_CAPTION: SerializedEditor = (() => {
  const editor = createHeadlessEditor({ nodes: [] });
  return editor.toJSON() as SerializedEditor;
})();

/**
 * AIDEV-NOTE: CDS ImageNode(type "image")와 호환되는 headless 구현.
 * CDS 버전은 DecoratorNode<JSX.Element>이며 중첩 caption 에디터를 가지지만,
 * headless에서는 caption을 빈 상태로 직렬화한다.
 */
export class ImageNode extends DecoratorNode<null> {
  __src: string;
  __altText: string;
  __maxWidth: number;
  __width: number;
  __height: number;

  static getType(): string {
    return "image";
  }

  static clone(node: ImageNode): ImageNode {
    return new ImageNode(
      node.__src,
      node.__altText,
      node.__maxWidth,
      node.__width,
      node.__height,
      node.__key,
    );
  }

  static importJSON(serializedNode: SerializedImageNode): ImageNode {
    return $createImageNode({
      src: serializedNode.src,
      altText: serializedNode.altText,
      maxWidth: serializedNode.maxWidth,
      width: serializedNode.width,
      height: serializedNode.height,
    });
  }

  constructor(
    src: string,
    altText: string,
    maxWidth: number,
    width: number,
    height: number,
    key?: NodeKey,
  ) {
    super(key);
    this.__src = src;
    this.__altText = altText;
    this.__maxWidth = maxWidth;
    this.__width = width;
    this.__height = height;
  }

  exportJSON(): SerializedImageNode {
    return {
      ...super.exportJSON(),
      type: "image",
      version: 1,
      src: this.__src,
      altText: this.__altText,
      maxWidth: this.__maxWidth,
      width: this.__width,
      height: this.__height,
      showCaption: false,
      caption: EMPTY_CAPTION,
    };
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

  getSrc(): string {
    return this.__src;
  }

  getAltText(): string {
    return this.__altText;
  }

  getWidth(): number {
    return this.__width;
  }

  getHeight(): number {
    return this.__height;
  }
}

export function $createImageNode({
  src,
  altText,
  maxWidth = 800,
  width = 0,
  height = 0,
}: ImagePayload): ImageNode {
  return new ImageNode(src, altText, maxWidth, width, height);
}

export function $isImageNode(
  node: LexicalNode | null | undefined,
): node is ImageNode {
  return node instanceof ImageNode;
}
