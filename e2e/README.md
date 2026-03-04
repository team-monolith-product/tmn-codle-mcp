# E2E 테스트

Vitest + Claude fixture 기반으로 Codle MCP 서버의 전체 도구를 자동 검증한다.
각 테스트가 독립 Claude 프로세스를 spawn하여 병렬 실행된다.

## 구조

```
e2e/
├── vitest.config.ts        # e2e 전용 vitest 설정
├── global-setup.ts         # MCP 서버 기동 + 유저 생성 + 토큰 취득
├── fixtures/
│   └── claude.ts           # test.extend로 claude fixture 정의
├── lib/
│   ├── claude-runner.ts    # ClaudeRunner 클래스 (spawn + ndjson 파싱)
│   └── ndjson.ts           # NDJSON 파서 + ClaudeResult 타입
├── tests/
│   ├── tags.test.ts        # 태그 조회 테스트 (readonly)
│   ├── materials.test.ts   # 자료 검색 + CRUD 테스트
│   └── activities.test.ts  # 활동 CRUD + 코스 흐름 테스트
└── results/                # 기존 결과 보존
```

## 사전 준비

```bash
cp .env.e2e.example .env.e2e
```

`.env.e2e`에 다음 값을 설정한다:

| 변수                 | 설명                                     |
| -------------------- | ---------------------------------------- |
| `E2E_TENANT_NUMBER`  | E2E 테넌트 번호 (기본 17)                |
| `E2E_USER_CLIENT_ID` | Doorkeeper OAuth Application의 client_id |

```bash
npm run build
```

## 실행

```bash
npm run e2e
```

## 테스트 구조

- **global-setup**: MCP 서버 기동 → health check → E2E 유저 생성 → OAuth 토큰 → `.mcp-config.tmp.json` 작성
- **claude fixture**: 각 테스트에 `ClaudeRunner` 인스턴스를 주입. 독립 Claude 프로세스 spawn.
- **검증**: `ClaudeResult`의 `toolNames`, `errors` 등 구조화된 데이터로 검증 (텍스트 의존 X)
