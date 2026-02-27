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
│   ├── index.ts          # Entry point (HTTP transport)
│   ├── server.ts         # McpServer 인스턴스 + instructions
│   ├── config.ts         # 환경변수 (dotenv)
│   ├── logger.ts         # stderr 로깅
│   ├── api/
│   │   ├── client.ts     # CodleClient (fetch, PAT 인증)
│   │   ├── models.ts     # JSON:API 유틸
│   │   └── errors.ts     # CodleAPIError
│   └── tools/
│       ├── register.ts   # 모든 tool 일괄 등록
│       ├── activities.ts
│       ├── materials.ts
│       └── tags.ts
├── tests/
│   ├── helpers.ts
│   ├── activities.test.ts
│   ├── materials.test.ts
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
  └─ MCP Protocol (Streamable HTTP)
       └─ codle-mcp (이 서버, Node.js)
            └─ HTTP/fetch (JSON:API)
                 └─ jce-class-rails (/api/v1/*)
                      └─ user-rails (토큰 검증)
```

### Transport

`node:http` + MCP SDK의 `StreamableHTTPServerTransport` (stateless)를 사용한다.

- `POST /mcp` — MCP 프로토콜 처리
- `GET /mcp` — SSE 스트림
- `DELETE /mcp` — 세션 종료
- `GET /health` — 헬스체크

### 인증

Per-request `Authorization: Bearer` 헤더 방식. MCP 클라이언트가 HTTP 요청 시 토큰을 전달하며, 서버는 `AsyncLocalStorage`로 요청별 토큰을 관리한다. 서버 자체는 토큰을 환경변수로 보관하지 않는다.

| 엔드포인트 | 인증 방식 | MCP 사용 |
|---|---|---|
| `/api/v1/materials` | `authorize_user_token!` | O |
| `/api/v1/activities` | `authorize_user_token!` | O |
| `/api/v1/tags` | 인증 없음 (public) | O |

## 디버깅

### 로그 레벨

`CODLE_LOG_LEVEL` 환경변수로 로그 레벨을 설정한다. 로그는 **stderr**로 출력된다.

| 레벨 | 출력 내용 |
|---|---|
| `ERROR` | 예외만 |
| `WARNING` | API 에러 응답 (상태코드, 본문 300자) |
| `INFO` | 서버 시작, 인증 성공 (기본값) |
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
        "CODLE_LOG_LEVEL": "DEBUG"
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
22:16:05 [DEBUG] codle_mcp: GET /api/v1/materials params={"filter[query]":"AI","page[size]":"5"}
22:16:05 [DEBUG] codle_mcp: GET /api/v1/materials → 200
22:16:10 [WARNING] codle_mcp: POST /api/v1/activities → 422: {"errors":[...]}
```
