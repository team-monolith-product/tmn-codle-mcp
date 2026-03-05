# E2E 테스트

Vitest + Claude fixture 기반으로 Codle MCP 서버의 도구를 자동 검증한다.

## 사전 준비

```bash
cp .env.e2e.example .env.e2e
npm run build
```

`.env.e2e`에 `E2E_TENANT_NUMBER`, `E2E_USER_CLIENT_ID`를 설정한다.

## 실행

```bash
npm run e2e
```

## 테스트 작성 원칙

### 1. Single Tool Contract

한 테스트는 핵심 계약 하나만 검증한다.
주인공 도구의 결과만 깊이 검증하고, 보조 도구는 호출 여부(`toolNames`)만 assert한다.

### 2. Black-box Prompting

프롬프트는 도구 내부를 모르는 최종 사용자의 자연어여야 한다.
도구명(`manage_tags`), 파라미터명(`is_public=true`), 지시문(`도구를 반드시 호출해`)은 모두 누출(leakage)이다.

```ts
// Good
await claude.run("공개된 자료 5개를 검색해줘.");

// Bad — 도구명과 파라미터 누출
await claude.run(
  "search_materials 도구로 is_public=true, page_size=5로 검색해줘. 도구를 반드시 호출해.",
);
```

### 3. Contrastive Seeding

seed 데이터는 정답과 오답을 모두 포함해야 한다.
"공개 자료가 나온다"를 증명하려면 비공개 자료도 seed해서, 그것이 결과에서 빠지는지까지 확인한다.

```ts
// Good — 공개/비공개 모두 seed
const pub = await createMaterial(factory, { isPublic: true });
const priv = await createMaterial(factory, { isPublic: false });
// → 결과에 pub.id는 포함, priv.id는 미포함 확인

// Bad — 공개만 seed하면 필터링이 동작하는지 증명 불가
const pub = await createMaterial(factory, { isPublic: true });
```

### 4. Tool-level Assertion

검증의 source of truth는 MCP 도구의 원본 응답(`tool_result`)이다.
Claude가 재해석한 최종 텍스트(`result.text`)가 아니라, `extractText(toolResult)`에서 꺼낸 도구 반환값을 확인한다.

```ts
// Good — tool result 원본 검증
const interaction = findToolResult(
  result.toolInteractions,
  "mcp__codle__manage_materials",
);
const text = extractText(interaction!.result!);
expect(text).toMatch(/자료 생성 완료/);

// Bad — Claude의 최종 응답에 의존
expect(result.text).toContain("자료를 생성했습니다");
```

### 5. Orthogonality

테스트 간 검증 영역이 겹치지 않는다.
조회 전용 테스트가 있으면 생성 테스트에서 조회를 붙이지 않는다. 각 테스트는 자기 도구의 계약만 책임진다.

### 6. Describe per Tool

`describe`는 MCP 도구명으로 그룹핑한다. 테스트 이름은 검증 내용만 담는다.

```ts
// Good — 도구별 describe, 테스트는 검증 내용만
describe("search_materials", () => {
  test("seed한 내 자료가 결과에 포함", ...);
  test("비공개 자료가 공개 검색에서 제외", ...);
});

// Bad — 단일 describe에 도구명을 테스트마다 반복
describe("materials", () => {
  test("search_materials — seed한 내 자료가 결과에 포함", ...);
  test("search_materials — 비공개 자료가 공개 검색에서 제외", ...);
});
```
