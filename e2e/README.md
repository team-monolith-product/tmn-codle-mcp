# E2E 테스트

Vitest + Claude fixture 기반으로 Codle CLI의 커맨드를 자동 검증한다.

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

## 언제 실행하는가

자연어 프롬프트 → CLI bash 호출 계약을 검증하는 테스트다.
1회 실행에 약 **$8~20 / 70분** (haiku~opus x7)이 소요되므로, 개발 중 반복 실행용이 아니다.

| 시점                                                      | 실행 여부 | 이유                                  |
| --------------------------------------------------------- | --------- | ------------------------------------- |
| **커맨드 인터페이스 변경** (flags, description, examples) | O         | `--help` 기반 AI 호출 계약 검증       |
| **비즈니스 로직(API 응답 등) 변경**                       | X         | unit test 범위                        |
| **개발 중 반복 실행**                                     | X         | 느리고 비결정적, 피드백 루프에 부적합 |

## 디렉토리 컨벤션

e2e 테스트는 `e2e/tests/{command}/{subcommand}.test.ts` 구조를 따른다. 디렉토리명은 **반드시** `src/commands/` 디렉토리명과 동일해야 한다.

```
src/commands/material/create.ts      → e2e/tests/material/create.test.ts
src/commands/activity/set-flow.ts    → e2e/tests/activity/set-flow.test.ts
```

## 테스트 작성 원칙

### 1. Single Command Contract

한 테스트는 핵심 계약 하나만 검증한다.
대상 커맨드의 bash 호출과 JSON 결과만 검증하고, 보조 커맨드는 호출 여부만 assert한다.

### 2. Black-box Prompting

프롬프트는 커맨드 내부를 모르는 최종 사용자의 자연어여야 한다.
커맨드명(`codle material search`), 플래그명(`--is-public`), 지시문(`커맨드를 반드시 호출해`)은 모두 누출(leakage)이다.

```ts
// Good
await claude.run("공개된 자료 5개를 검색해줘.");

// Bad — 커맨드명과 플래그 누출
await claude.run("codle material search --is-public --page-size 5로 검색해줘.");
```

### 3. Contrastive Seeding

seed 데이터는 정답과 오답을 모두 포함해야 한다.
"공개 자료가 나온다"를 증명하려면 비공개 자료도 seed해서, 그것이 결과에서 빠지는지까지 확인한다.

### 4. Command-level Assertion

검증의 source of truth는 CLI 커맨드의 JSON 출력이다.
Claude가 재해석한 최종 텍스트(`result.text`)가 아니라, `parseCodleOutput(interaction.result)`에서 꺼낸 JSON을 확인한다.

```ts
// Good — CLI JSON 출력 검증
const interaction = findCodleInteraction(
  result.toolInteractions,
  "material search",
);
const output = parseCodleOutput(interaction!.result!);
expect(output).toBeDefined();

// Bad — Claude의 최종 응답에 의존
expect(result.text).toContain("자료를 검색했습니다");
```

### 5. Orthogonality

테스트 간 검증 영역이 겹치지 않는다.

### 6. Describe per Command

`describe`는 CLI 커맨드로 그룹핑한다.

```ts
describe("material search", () => {
  test("seed한 내 자료가 결과에 포함", ...);
  test("비공개 자료가 공개 검색에서 제외", ...);
});
```
