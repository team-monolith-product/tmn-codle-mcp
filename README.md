# Codle MCP Server

사내 이용자(고객팀, 컨텐츠팀)를 위한 Codle MCP 서버.
Claude Desktop/Code에서 자연어로 Codle 자료를 조회/생성/수정할 수 있다.

> 설치/설정 가이드: [SETUP.md](SETUP.md)

## 기술 스택

| 항목 | 선택 |
|------|------|
| Runtime | Node.js 22+ |
| MCP SDK | `@modelcontextprotocol/sdk` |
| HTTP | native `fetch` |
| Validation | `zod` |
| Test | `vitest` |
| Build | `tsc` (ESM, Node16 module) |

## 프로젝트 구조

```
tmn-codle-mcp/
├── src/
│   ├── index.ts          # Entry point (stdio transport)
│   ├── server.ts         # McpServer 인스턴스 + instructions
│   ├── config.ts         # 환경변수 (dotenv)
│   ├── logger.ts         # stderr 로깅
│   ├── api/
│   │   ├── client.ts     # CodleClient (fetch, OAuth2, retry)
│   │   ├── models.ts     # JSON:API 유틸
│   │   └── errors.ts     # CodleAPIError
│   └── tools/
│       ├── register.ts   # 모든 tool 일괄 등록
│       ├── activities.ts
│       ├── materials.ts
│       ├── problems.ts
│       ├── bundles.ts
│       └── tags.ts
├── tests/
│   ├── helpers.ts
│   ├── activities.test.ts
│   ├── materials.test.ts
│   ├── problems.test.ts
│   ├── bundles.test.ts
│   ├── models.test.ts
│   └── client.test.ts
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .env.example
├── CLAUDE.md
└── README.md
```

## 아키텍처

```
Claude Desktop/Code
  └─ MCP Protocol (stdio)
       └─ codle-mcp (이 서버, Node.js)
            └─ HTTP/fetch (JSON:API)
                 └─ jce-class-rails (/api/v1/*)
                      └─ user-rails (토큰 검증)
```

### 인증 흐름

```
1. MCP 서버 시작 (토큰 없음)
2. 첫 API 요청 시 password grant로 토큰 자동 발급
   POST user-rails/oauth/token (email + password + client_id)
   → access_token + refresh_token
3. class-rails에 Bearer 토큰으로 요청
4. class-rails → user-rails /api/v1/me로 원격 검증 (5분 캐시)
5. 토큰 만료 시 (401) → refresh_token으로 갱신, 실패 시 재인증
```

| 엔드포인트 | 인증 방식 | MCP 사용 |
|---|---|---|
| `/api/v1/materials` | `authorize_user_token!` | O |
| `/api/v1/activities` | `authorize_user_token!` | O |
| `/api/v1/problems` | `authorize_user_token!` | O |
| `/api/v1/material_bundles` | `authorize_user_token!` | O |
| `/api/v1/tags` | 인증 없음 (public) | O |

### 토큰 특성

- **타입**: Opaque (JWT 아님) — Doorkeeper DB 저장
- **수명**: 교사 120분, 학생 30분
- **갱신**: refresh_token (만료 없음, Redis 활동 기록 필요)
- **발급**: password grant (user-rails Doorkeeper)

## 디버깅

### 로그 레벨

`CODLE_LOG_LEVEL` 환경변수로 로그 레벨을 설정한다. MCP는 stdio 프로토콜이므로 로그는 **stderr**로 출력된다.

| 레벨 | 출력 내용 |
|---|---|
| `ERROR` | 예외만 |
| `WARNING` | API 에러 응답 (상태코드, 본문 300자) |
| `INFO` | 서버 시작, 인증 성공, 토큰 갱신 (기본값) |
| `DEBUG` | 모든 API 요청 (method, path, params, body) + 응답 상태코드 |

### 디버그 로깅 활성화

`.mcp.json`의 `env`에 추가:

```json
{
  "mcpServers": {
    "codle": {
      "command": "node",
      "args": ["path/to/tmn-codle-mcp/dist/index.js"],
      "env": {
        "CODLE_LOG_LEVEL": "DEBUG",
        ...
      }
    }
  }
}
```

설정 변경 후 MCP 서버를 재시작해야 반영된다.

### 로그 확인 방법

Claude Code에서는 stderr가 MCP 서버 로그 파일로 리다이렉트된다:

```bash
# Claude Code MCP 로그 위치
tail -f ~/.claude/logs/mcp-server-codle.log
```

Claude Desktop은 `~/Library/Logs/Claude/` 하위에서 확인할 수 있다.

### 로그 출력 예시

```
22:16:03 [INFO] codle_mcp: codle-mcp 서버 시작
22:16:05 [INFO] codle_mcp: 인증 성공 (email=teacher@example.com)
22:16:05 [DEBUG] codle_mcp: GET /api/v1/materials params={"filter[query]":"AI","page[size]":"5"}
22:16:05 [DEBUG] codle_mcp: GET /api/v1/materials → 200
22:16:10 [WARNING] codle_mcp: POST /api/v1/activities → 422: {"errors":[...]}
```

## TODO

### 인증

- [x] Password Grant 자동 인증 (email/password → 토큰 발급, 401 시 refresh → 재인증)
- [ ] 환경별(dev/prod) 설정 분리

### API 클라이언트
- [ ] bulk API 지원 (create_many, update_many) - materials, problems, tags
- [ ] 에러 응답 파싱 개선 (JSON:API errors 포맷)
- [ ] 요청 재시도 (retry) 로직
- [ ] 페이지네이션 자동 처리 (전체 결과 조회)

### Tool 개선
- [ ] tool description 튜닝 (LLM tool 선택 정확도 향상)
- [ ] 검색 필터 파라미터 확장 (ransack 쿼리 활용)
- [ ] 자료 생성 시 활동까지 한번에 생성하는 복합 tool 검토
- [ ] 문제 생성 시 test_case, problem_answer 포함 지원

### 테스트
- [x] tool별 단위 테스트 (mock API) — 119개
- [ ] dev 환경 실제 API 연동 테스트
- [ ] Claude Desktop 연동 E2E 테스트

### 배포/운영
- [ ] Docker 이미지 빌드
- [ ] 사내 배포 방안 (팀원 onboarding)
