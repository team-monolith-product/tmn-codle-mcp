/**
 * AIDEV-NOTE: CDS MarkdownTransformers의 headless 포팅.
 * CDS 원본: jce-codle-cds/src/cds/patterns/LexicalEditor/plugins/MarkdownTransformers/index.ts
 * 차이점: @lexical/react 대신 로컬 headless 노드 사용, SheetInput/LLM transformer 제외,
 * MULTILINE_ELEMENT_TRANSFORMERS(CODE) 추가 (CDS 원본에는 누락됨).
 */
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  CHECK_LIST,
  ELEMENT_TRANSFORMERS,
  MULTILINE_ELEMENT_TRANSFORMERS,
  TEXT_FORMAT_TRANSFORMERS,
  TEXT_MATCH_TRANSFORMERS,
  type ElementTransformer,
  type TextMatchTransformer,
  type Transformer,
} from "@lexical/markdown";
import {
  $createTableCellNode,
  $createTableNode,
  $createTableRowNode,
  $isTableCellNode,
  $isTableNode,
  $isTableRowNode,
  TableCellHeaderStates,
  TableCellNode,
  TableNode,
  TableRowNode,
} from "@lexical/table";
import {
  $createParagraphNode,
  $isParagraphNode,
  $isTextNode,
  type LexicalNode,
} from "lexical";
import {
  $createHorizontalRuleNode,
  $isHorizontalRuleNode,
  HorizontalRuleNode,
} from "./nodes/HorizontalRuleNode.js";
import {
  $createImageNode,
  $isImageNode,
  ImageNode,
} from "./nodes/ImageNode.js";

export const HR: ElementTransformer = {
  dependencies: [HorizontalRuleNode],
  export: (node: LexicalNode) => ($isHorizontalRuleNode(node) ? "***" : null),
  regExp: /^(---|\*\*\*|___)\s?$/,
  replace: (parentNode, _1, _2, isImport) => {
    const line = $createHorizontalRuleNode();
    if (isImport || parentNode.getNextSibling() != null) {
      parentNode.replace(line);
    } else {
      parentNode.insertBefore(line);
    }
    line.selectNext();
  },
  type: "element",
};

// AIDEV-NOTE: CDS ImageNode는 isInline()=false (block decorator)이며 root.children 직속이어야 한다.
// CDS 본가의 IMAGE transformer는 textNode.replace(imageNode)로 paragraph 안에 넣는 버그가 있다.
// CLI에서는 replace 콜백에서 image를 parent paragraph 밖으로 꺼내 root level에 삽입하고,
// 뒤쪽 형제 노드가 있으면 새 paragraph로 분리한다. CDS 본가도 동일 수정이 필요하나 별도 PR.

// AIDEV-NOTE: 이미지 크기 지정 문법 — ![alt](src =WIDTHxHEIGHT) 또는 ![alt](src =WIDTH).
// "=WxH" 접미사를 파싱하여 ImageNode에 width/height를 전달한다.
// 0은 CDS에서 "inherit"(자연 크기)로 해석된다.
const SIZE_SUFFIX_RE = /^(.+?)\s+=(\d+)(?:x(\d+))?$/;

export const IMAGE: TextMatchTransformer = {
  dependencies: [ImageNode],
  export: (node) => {
    if (!$isImageNode(node)) {
      return null;
    }
    const w = node.getWidth();
    const h = node.getHeight();
    const sizeSuffix = w ? (h ? ` =${w}x${h}` : ` =${w}`) : h ? ` =0x${h}` : "";
    return `![${node.getAltText()}](${node.getSrc()}${sizeSuffix})`;
  },
  // AIDEV-NOTE: \\? — AI 에이전트가 !를 \!로 이스케이프하는 경우를 허용한다.
  importRegExp: /\\?!(?:\[([^[]*)\])(?:\(([^(]+)\))/,
  regExp: /\\?!(?:\[([^[]*)\])(?:\(([^(]+)\))$/,
  replace: (textNode, match) => {
    const [, altText, rawSrc] = match;
    const sizeMatch = rawSrc.match(SIZE_SUFFIX_RE);
    let src: string;
    let width = 0;
    let height = 0;
    if (sizeMatch) {
      src = sizeMatch[1];
      width = parseInt(sizeMatch[2], 10);
      height = sizeMatch[3] ? parseInt(sizeMatch[3], 10) : 0;
    } else {
      src = rawSrc;
    }
    const imageNode = $createImageNode({
      altText,
      maxWidth: 800,
      src,
      width,
      height,
    });
    const parent = textNode.getParentOrThrow();

    if (!$isParagraphNode(parent)) {
      textNode.replace(imageNode);
      return;
    }

    // 뒤쪽 형제들을 새 paragraph로 분리
    const nextSiblings: LexicalNode[] = [];
    let sibling = textNode.getNextSibling();
    while (sibling) {
      nextSiblings.push(sibling);
      sibling = sibling.getNextSibling();
    }

    parent.insertAfter(imageNode);
    if (nextSiblings.length > 0) {
      const tail = $createParagraphNode();
      imageNode.insertAfter(tail);
      tail.append(...nextSiblings);
    }

    textNode.remove();
    if (parent.isEmpty()) parent.remove();
  },
  trigger: ")",
  type: "text-match",
};

const TABLE_ROW_REG_EXP = /^(?:\|)(.+)(?:\|)\s?$/;
const TABLE_ROW_DIVIDER_REG_EXP = /^(\| ?:?-*:? ?)+\|\s?$/;

export const TABLE: ElementTransformer = {
  dependencies: [TableNode, TableRowNode, TableCellNode],
  export: (node: LexicalNode) => {
    if (!$isTableNode(node)) {
      return null;
    }

    const output: string[] = [];

    for (const row of node.getChildren()) {
      const rowOutput = [];
      if (!$isTableRowNode(row)) {
        continue;
      }

      let isHeaderRow = false;
      for (const cell of row.getChildren()) {
        if ($isTableCellNode(cell)) {
          rowOutput.push(
            $convertToMarkdownString(CUSTOM_TRANSFORMERS, cell).replace(
              /\n/g,
              "\\n",
            ),
          );
          if (cell.__headerState === TableCellHeaderStates.ROW) {
            isHeaderRow = true;
          }
        }
      }

      output.push(`| ${rowOutput.join(" | ")} |`);
      if (isHeaderRow) {
        output.push(`| ${rowOutput.map(() => "---").join(" | ")} |`);
      }
    }

    return output.join("\n");
  },
  regExp: TABLE_ROW_REG_EXP,
  replace: (parentNode, _1, match) => {
    if (TABLE_ROW_DIVIDER_REG_EXP.test(match[0])) {
      const table = parentNode.getPreviousSibling();
      if (!table || !$isTableNode(table)) {
        return;
      }

      const rows = table.getChildren();
      const lastRow = rows[rows.length - 1] as LexicalNode | undefined;
      if (!lastRow || !$isTableRowNode(lastRow)) {
        return;
      }

      lastRow.getChildren().forEach((cell) => {
        if (!$isTableCellNode(cell)) {
          return;
        }
        cell.toggleHeaderStyle(TableCellHeaderStates.ROW);
      });

      parentNode.remove();
      return;
    }

    const matchCells = mapToTableCells(match[0]);

    if (matchCells == null) {
      return;
    }

    const rows = [matchCells];
    let sibling = parentNode.getPreviousSibling();
    let maxCells = matchCells.length;

    while (sibling) {
      if (!$isParagraphNode(sibling)) {
        break;
      }

      if (sibling.getChildrenSize() !== 1) {
        break;
      }

      const firstChild = sibling.getFirstChild();

      if (!$isTextNode(firstChild)) {
        break;
      }

      const cells = mapToTableCells(firstChild.getTextContent());

      if (cells == null) {
        break;
      }

      maxCells = Math.max(maxCells, cells.length);
      rows.unshift(cells);
      const previousSibling = sibling.getPreviousSibling();
      sibling.remove();
      sibling = previousSibling;
    }

    const table = $createTableNode();

    for (const cells of rows) {
      const tableRow = $createTableRowNode();
      table.append(tableRow);

      for (let i = 0; i < maxCells; i++) {
        tableRow.append(i < cells.length ? cells[i] : createTableCell(""));
      }
    }

    const previousSibling = parentNode.getPreviousSibling();
    if (
      $isTableNode(previousSibling) &&
      getTableColumnsSize(previousSibling) === maxCells
    ) {
      previousSibling.append(...table.getChildren());
      parentNode.remove();
    } else {
      parentNode.replace(table);
    }

    table.selectEnd();
  },
  type: "element",
};

function getTableColumnsSize(table: TableNode) {
  const row = table.getFirstChild();
  return $isTableRowNode(row) ? row.getChildrenSize() : 0;
}

const createTableCell = (textContent: string): TableCellNode => {
  textContent = textContent.replace(/\\n/g, "\n");
  const cell = $createTableCellNode(TableCellHeaderStates.NO_STATUS);
  $convertFromMarkdownString(textContent, CUSTOM_TRANSFORMERS, cell);
  return cell;
};

const mapToTableCells = (textContent: string): Array<TableCellNode> | null => {
  const match = textContent.match(TABLE_ROW_REG_EXP);
  if (!match || !match[1]) {
    return null;
  }
  return match[1].split("|").map((text) => createTableCell(text));
};

export const CUSTOM_TRANSFORMERS: Array<Transformer> = [
  TABLE,
  HR,
  IMAGE,
  CHECK_LIST,
  ...ELEMENT_TRANSFORMERS,
  ...MULTILINE_ELEMENT_TRANSFORMERS,
  ...TEXT_FORMAT_TRANSFORMERS,
  ...TEXT_MATCH_TRANSFORMERS,
];
