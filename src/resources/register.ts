import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// AIDEV-NOTE: 활동지 directive 문법 문서를 MCP Resource로 제공한다.
// tool description에 전체 문서를 넣으면 매 대화마다 토큰이 소비되므로,
// Resource로 분리하여 AI 에이전트가 필요할 때만 읽도록 한다.

const SHEET_DIRECTIVES_DOC = `# 활동지(sheet) 입력란 Directive 문법

활동지(sheet) 문제의 \`content\`에 아래 directive를 사용하면 입력란 노드가 자동 생성된다.
\`convertFromMarkdown\`가 markdown을 Lexical JSON으로 변환할 때 directive 블록을 인식하여 해당 노드로 교체한다.

일반 markdown(텍스트, 볼드, 이미지 등)과 자유롭게 혼합할 수 있다.

---

## 단답형 입력란 (short-answer)

한 줄짜리 텍스트 입력 필드를 생성한다.

\`\`\`
:::short-answer{placeholder="답을 입력하세요"}
:::
\`\`\`

- \`placeholder\` (선택): 입력란에 표시할 안내 텍스트

## 서술형 입력란 (long-answer)

여러 줄 텍스트 입력 필드를 생성한다.

\`\`\`
:::long-answer{placeholder="자세히 서술하세요"}
:::
\`\`\`

- \`placeholder\` (선택): 입력란에 표시할 안내 텍스트

## 선택지 (choice)

선택 항목 목록을 생성한다. 각 항목은 \`- \`(하이픈+공백)으로 시작.

\`\`\`
:::choice{multiple=false}
- 항목 1
- 항목 2
- 항목 3
:::
\`\`\`

- \`multiple\` (선택, 기본 false): \`true\`이면 복수 선택 허용

## 자기평가 (self-eval)

자기평가 항목을 생성한다. 각 평가 질문은 \`- \`(하이픈+공백)으로 시작.

\`\`\`
:::self-eval{icon=emoji labels="잘함,보통,노력필요"}
- 나는 적극적으로 참여했다
- 나는 친구의 의견을 존중했다
:::
\`\`\`

- \`icon\` (선택, 기본 "emoji"): 아이콘 유형
- \`labels\` (필수): 쉼표로 구분된 평가 라벨 목록

---

## 전체 예시

하나의 content 안에서 일반 markdown과 directive를 혼합:

\`\`\`markdown
다음 글을 읽고 물음에 답하세요.

> 봄이 오면 산에 들에 진달래 피네

**1번.** 이 시에서 계절적 배경은?

:::short-answer{placeholder="계절을 입력하세요"}
:::

**2번.** 이 시의 느낌을 자유롭게 서술하세요.

:::long-answer{placeholder="느낀 점을 자세히 써 보세요"}
:::

**3번.** 이 시의 소재는 무엇인가요?

:::choice{multiple=false}
- 진달래
- 장미
- 해바라기
:::

**자기평가**

:::self-eval{icon=emoji labels="잘함,보통,노력필요"}
- 시를 꼼꼼히 읽었다
- 내 생각을 잘 표현했다
:::
\`\`\`
`;

export function registerAllResources(server: McpServer): void {
  server.resource(
    "sheet-directives",
    "codle://docs/sheet-directives",
    {
      description: "활동지 입력란 directive 문법 가이드",
      mimeType: "text/markdown",
    },
    async () => ({
      contents: [
        {
          uri: "codle://docs/sheet-directives",
          mimeType: "text/markdown",
          text: SHEET_DIRECTIVES_DOC,
        },
      ],
    }),
  );
}
