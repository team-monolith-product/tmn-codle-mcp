// AIDEV-NOTE: :::directive{attrs} 블록을 파싱하여 CDS Lexical 노드 JSON으로 변환한다.
// Markdown에 존재하지 않는 활동지 전용 노드(sheet-input, sheet-select, self-evaluation)를
// 커스텀 directive 문법으로 표현하기 위한 모듈.

import type { SerializedEditorState, SerializedLexicalNode } from "lexical";

// ── Types ──

interface ParsedDirective {
  nodeType: "sheet-input" | "sheet-select" | "self-evaluation";
  attrs: Record<string, string>;
  contentLines: string[];
}

// ── Directive names → node type mapping ──

const DIRECTIVE_MAP: Record<
  string,
  { nodeType: ParsedDirective["nodeType"]; multiline?: boolean }
> = {
  "short-answer": { nodeType: "sheet-input", multiline: false },
  "long-answer": { nodeType: "sheet-input", multiline: true },
  choice: { nodeType: "sheet-select" },
  "self-eval": { nodeType: "self-evaluation" },
};

// ── Parsing ──

const DIRECTIVE_OPEN_RE = /^:::(\S+?)(?:\{([^}]*)\})?\s*$/;
const DIRECTIVE_CLOSE_RE = /^:::\s*$/;

function parseAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /(\w+)=(?:"([^"]*)"|(\S+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    attrs[m[1]] = m[2] ?? m[3];
  }
  return attrs;
}

/**
 * Markdown 문자열에서 `:::directive{...}` 블록을 추출한다.
 * 추출된 위치에는 `__DIRECTIVE_N__` 플레이스홀더를 삽입한다.
 */
export function extractDirectives(markdown: string): {
  cleaned: string;
  directives: ParsedDirective[];
} {
  const lines = markdown.split("\n");
  const directives: ParsedDirective[] = [];
  const output: string[] = [];

  let i = 0;
  while (i < lines.length) {
    const openMatch = lines[i].match(DIRECTIVE_OPEN_RE);
    if (openMatch) {
      const name = openMatch[1];
      const mapped = DIRECTIVE_MAP[name];
      if (mapped) {
        const attrs = parseAttrs(openMatch[2] || "");
        const contentLines: string[] = [];
        i++;
        while (i < lines.length && !DIRECTIVE_CLOSE_RE.test(lines[i])) {
          contentLines.push(lines[i]);
          i++;
        }
        i++; // skip closing :::

        if (mapped.multiline !== undefined) {
          attrs.multiline = String(mapped.multiline);
        }

        const idx = directives.length;
        directives.push({
          nodeType: mapped.nodeType,
          attrs,
          contentLines,
        });
        // AIDEV-NOTE: placeholder 앞뒤에 blank line을 보장한다.
        // 그렇지 않으면 markdown 파서가 직전/직후 텍스트와 같은 paragraph로 합쳐서
        // getPlaceholderIndex가 매칭에 실패하고 placeholder 문자열이 그대로 노출된다.
        if (output.length > 0 && output[output.length - 1].trim() !== "") {
          output.push("");
        }
        output.push(`DIRECTIVEPLACEHOLDER${idx}END`);
        output.push("");
        continue;
      }
    }
    output.push(lines[i]);
    i++;
  }

  return { cleaned: output.join("\n"), directives };
}

// ── Node builders ──

function buildSheetInputNode(
  attrs: Record<string, string>,
): Record<string, unknown> {
  return {
    type: "sheet-input",
    version: 1,
    multiline: attrs.multiline === "true",
    value: "",
    placeholder: attrs.placeholder || "",
  };
}

function buildSheetSelectNode(
  attrs: Record<string, string>,
  lines: string[],
): Record<string, unknown> {
  const selections = lines
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- "))
    .map((l, i) => ({
      show: { image: null, text: l.slice(2) },
      value: String(i),
    }));

  return {
    type: "sheet-select",
    version: 1,
    selections,
    selected: [],
    allowMultipleAnswers: attrs.multiple === "true",
  };
}

function buildSelfEvaluationNode(
  attrs: Record<string, string>,
  lines: string[],
): Record<string, unknown> {
  const labels = (attrs.labels || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const evaluations = lines
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- "))
    .map((l) => ({
      question: { text: l.slice(2) },
      selectedLabelIndex: null,
    }));

  return {
    type: "self-evaluation",
    version: 1,
    iconType: attrs.icon || "emoji",
    labels,
    evaluations,
  };
}

function buildDirectiveNode(d: ParsedDirective): Record<string, unknown> {
  switch (d.nodeType) {
    case "sheet-input":
      return buildSheetInputNode(d.attrs);
    case "sheet-select":
      return buildSheetSelectNode(d.attrs, d.contentLines);
    case "self-evaluation":
      return buildSelfEvaluationNode(d.attrs, d.contentLines);
  }
}

// ── Post-processing ──

const PLACEHOLDER_RE = /^DIRECTIVEPLACEHOLDER(\d+)END$/;

function getPlaceholderIndex(node: SerializedLexicalNode): number | null {
  if (node.type !== "paragraph") return null;
  const children = (node as Record<string, unknown>).children as
    | SerializedLexicalNode[]
    | undefined;
  if (!children || children.length !== 1) return null;
  const textNode = children[0] as Record<string, unknown>;
  if (textNode.type !== "text") return null;
  const match = (textNode.text as string).match(PLACEHOLDER_RE);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * SerializedEditorState 내 플레이스홀더 paragraph를 directive 노드로 교체한다.
 */
export function replaceDirectivePlaceholders(
  state: SerializedEditorState,
  directives: ParsedDirective[],
): SerializedEditorState {
  if (directives.length === 0) return state;

  const root = state.root;
  const newChildren: SerializedLexicalNode[] = [];

  for (const child of root.children) {
    const idx = getPlaceholderIndex(child);
    if (idx !== null && idx < directives.length) {
      newChildren.push(
        buildDirectiveNode(directives[idx]) as SerializedLexicalNode,
      );
    } else {
      newChildren.push(child);
    }
  }

  return { root: { ...root, children: newChildren } };
}
